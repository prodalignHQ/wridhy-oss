import { Hono } from 'hono'
import { db } from '@momoney/db'
import {
  transactions,
  transactionOwners,
  owners,
  categories,
  financialAccounts,
} from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and, or, ilike, gte, lte, inArray, desc, asc, sql, isNull } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const transactionsRoute = new Hono<{
  Variables: { userId: string }
}>()

transactionsRoute.use('*', authMiddleware)

// ─── GET /v1/transactions ─────────────────────────────────────────────────────

const listQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

transactionsRoute.get('/', zValidator('query', listQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { accountId, startDate, endDate, categoryId, ownerId, search, page, limit } =
    c.req.valid('query')

  const conditions = [eq(transactions.userId, userId)]

  if (accountId) conditions.push(eq(transactions.accountId, accountId))
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
  if (search) conditions.push(ilike(transactions.description, `%${search}%`))
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)))
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)))

  // If ownerId filter is provided, we need an EXISTS subquery
  // We use a different approach: find all transaction IDs for that owner first
  let txnIds: string[] | undefined
  if (ownerId) {
    const ownerTxns = await db
      .select({ transactionId: transactionOwners.transactionId })
      .from(transactionOwners)
      .where(eq(transactionOwners.ownerId, ownerId))
    txnIds = ownerTxns.map((r) => r.transactionId)
    if (txnIds.length === 0) {
      return c.json({
        success: true,
        data: { transactions: [], total: 0, page, limit },
      })
    }
    conditions.push(inArray(transactions.id, txnIds))
  }

  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.date), desc(transactions.createdAt), desc(transactions.id)],
      limit,
      offset,
      with: {
        category: { columns: { id: true, name: true, color: true, icon: true } },
        transactionOwners: {
          with: {
            owner: { columns: { id: true, name: true, color: true, isDefault: true } },
          },
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(...conditions)),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  return c.json({
    success: true,
    data: {
      transactions: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// ─── PATCH /v1/transactions/:id ───────────────────────────────────────────────

const updateTxnSchema = z.object({
  comment: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

const bulkUpdateTxnCategorySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1),
  categoryId: z.string().uuid().nullable(),
})
 
const bulkUpdateTxnOwnersSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1),
  ownerIds: z.array(z.string().uuid()).min(1),
})

transactionsRoute.patch(
  '/bulk/category',
  zValidator('json', bulkUpdateTxnCategorySchema),
  async (c) => {
    const userId = c.get('userId')
    const { transactionIds, categoryId } = c.req.valid('json')
    const uniqueTransactionIds = Array.from(new Set(transactionIds))

    if (categoryId) {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, categoryId),
          or(eq(categories.userId, userId), isNull(categories.userId))
        ),
      })

      if (!category) {
        return c.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Category not found' } },
          400
        )
      }
    }

    const updated = await db
      .update(transactions)
      .set({ categoryId, updatedAt: new Date() })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, uniqueTransactionIds as string[])))
      .returning({ id: transactions.id })

    if (updated.length === 0) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No transactions found' } },
        404
      )
    }

    return c.json({
      success: true,
      data: {
        updatedCount: updated.length,
      },
    })
  }
)
 
transactionsRoute.patch(
  '/bulk/owners',
  zValidator('json', bulkUpdateTxnOwnersSchema),
  async (c) => {
    const userId = c.get('userId')
    const { transactionIds, ownerIds } = c.req.valid('json')
    const uniqueTransactionIds = Array.from(new Set(transactionIds))
 
    // Verify all owners belong to this user
    const validOwners = await db.query.owners.findMany({
      where: and(eq(owners.userId, userId), inArray(owners.id, ownerIds)),
    })
 
    if (validOwners.length !== ownerIds.length) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'One or more owner IDs are invalid' } },
        400
      )
    }
 
    // Fetch all transactions to ensure they belong to the user and to get their amounts
    const txns = await db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), inArray(transactions.id, uniqueTransactionIds as string[])),
    })
 
    if (txns.length === 0) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No transactions found' } },
        404
      )
    }
 
    const n = ownerIds.length
    const sharePercent = (100 / n).toFixed(2)
 
    await db.transaction(async (tx) => {
      // 1. Delete all existing ownership records for these transactions
      await tx
        .delete(transactionOwners)
        .where(inArray(transactionOwners.transactionId, uniqueTransactionIds as string[]))
 
      // 2. Insert new ownership records for each transaction
      for (const txn of txns) {
        const txnAmount = parseFloat(String(txn.amount))
        const shareAmount = (txnAmount / n).toFixed(2)
 
        for (const ownerId of ownerIds) {
          await tx.insert(transactionOwners).values({
            transactionId: txn.id,
            ownerId,
            amount: shareAmount,
            percentage: sharePercent,
          })
        }
      }
    })
 
    return c.json({
      success: true,
      data: {
        updatedCount: txns.length,
      },
    })
  }
)

transactionsRoute.patch('/:id', zValidator('json', updateTxnSchema), async (c) => {
  const userId = c.get('userId')
  const txnId = c.req.param('id')
  const body = c.req.valid('json')

  const [updated] = await db
    .update(transactions)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)))
    .returning()

  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    )
  }

  const hydrated = await db.query.transactions.findFirst({
    where: eq(transactions.id, updated.id),
    with: {
      category: { columns: { id: true, name: true, color: true, icon: true } },
      transactionOwners: {
        with: {
          owner: { columns: { id: true, name: true, color: true, isDefault: true } },
        },
      },
    },
  })

  return c.json({ success: true, data: hydrated ?? updated })
})

// ─── PUT /v1/transactions/:id/owners ─────────────────────────────────────────

const assignOwnersSchema = z.object({
  ownerIds: z.array(z.string().uuid()).min(1),
})

transactionsRoute.put('/:id/owners', zValidator('json', assignOwnersSchema), async (c) => {
  const userId = c.get('userId')
  const txnId = c.req.param('id')
  const { ownerIds } = c.req.valid('json')

  // Fetch the transaction (must belong to user)
  const txn = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, txnId), eq(transactions.userId, userId)),
  })

  if (!txn) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    )
  }

  // Verify all owners belong to this user
  const validOwners = await db.query.owners.findMany({
    where: and(eq(owners.userId, userId), inArray(owners.id, ownerIds)),
  })

  if (validOwners.length !== ownerIds.length) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'One or more owner IDs are invalid' } },
      400
    )
  }

  const n = ownerIds.length
  const txnAmount = parseFloat(String(txn.amount))
  const shareAmount = (txnAmount / n).toFixed(2)
  const sharePercent = (100 / n).toFixed(2)

  // Replace all owner rows in a transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(transactionOwners)
      .where(eq(transactionOwners.transactionId, txnId))

    for (const ownerId of ownerIds) {
      await tx.insert(transactionOwners).values({
        transactionId: txnId,
        ownerId,
        amount: shareAmount,
        percentage: sharePercent,
      })
    }
  })

  // Return updated transaction with owners
  const updated = await db.query.transactions.findFirst({
    where: eq(transactions.id, txnId),
    with: {
      category: { columns: { id: true, name: true, color: true, icon: true } },
      transactionOwners: {
        with: {
          owner: { columns: { id: true, name: true, color: true, isDefault: true } },
        },
      },
    },
  })

  return c.json({ success: true, data: updated })
})

// ─── GET /v1/transactions/export ─────────────────────────────────────────────

transactionsRoute.get('/export', zValidator('query', listQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { accountId, startDate, endDate, categoryId, search } = c.req.valid('query')

  const conditions = [eq(transactions.userId, userId)]
  if (accountId) conditions.push(eq(transactions.accountId, accountId))
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
  if (search) conditions.push(ilike(transactions.description, `%${search}%`))
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)))
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)))

  const rows = await db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [desc(transactions.date)],
    with: {
      category: { columns: { name: true } },
    },
  })

  const header = 'Date,Description,Amount,Type,Category,Comment\n'
  const lines = rows.map((r) => {
    const date = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date)
    const desc = `"${(r.description ?? '').replace(/"/g, '""')}"`
    const comment = `"${(r.comment ?? '').replace(/"/g, '""')}"`
    const category = r.category?.name ?? ''
    return `${date},${desc},${r.amount},${r.type},${category},${comment}`
  })

  const csv = header + lines.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="transactions.csv"',
    },
  })
})

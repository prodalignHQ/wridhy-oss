import { Hono } from 'hono'
import { db } from '@momoney/db'
import {
  invoiceItems,
  invoiceStatements,
  invoices,
  statements,
  transactions,
} from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type InvoiceOwnerSnapshot = {
  ownerId: string | null
  name: string
  color: string | null
  amount: string
  percentage: string
}

type InvoiceTransactionPayload = {
  id: string
  statementId: string | null
  date: Date
  description: string
  amount: string
  type: 'debit' | 'credit'
  isOneTime: boolean
  categoryId: string | null
  category: { id: string | null; name: string; color: string | null; type?: string | null } | null
  owners: InvoiceOwnerSnapshot[]
}

type InvoiceWithStatements = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>

const invoiceMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Expected YYYY-MM or YYYY-MM-DD')

const createInvoiceSchema = z.object({
  name: z.string().min(1),
  invoiceMonth: invoiceMonthSchema,
  statementIds: z.array(z.string().uuid()).min(1),
})

const updateInvoiceSchema = z
  .object({
    name: z.string().min(1).optional(),
    statementIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const invoicesRoute = new Hono<{
  Variables: { userId: string }
}>()

invoicesRoute.use('*', authMiddleware)

function normalizeInvoiceMonth(input: string): string {
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`
  return `${input.slice(0, 7)}-01`
}

function monthKey(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
  }

  return value.slice(0, 7)
}

function amountString(value: string | number): string {
  return typeof value === 'number' ? value.toFixed(2) : String(value)
}

function buildAnalysis(transactionsList: InvoiceTransactionPayload[]) {
  const ownerTotals = new Map<
    string,
    {
      ownerId: string | null
      name: string
      color: string | null
      total: number
      spendingTotal: number
      regularSpendingTotal: number
      oneTimeSpendingTotal: number
      investmentTotal: number
      regularInvestmentTotal: number
      oneTimeInvestmentTotal: number
      categories: Map<
        string,
        {
          categoryId: string | null
          category: string
          color: string | null
          type: string
          total: number
          regularTotal: number
          oneTimeTotal: number
        }
      >
    }
  >()

  const categoryTotalsMap = new Map<
    string,
    {
      categoryId: string | null
      category: string
      color: string | null
      type: string
      total: number
      regularTotal: number
      oneTimeTotal: number
    }
  >()

  for (const transaction of transactionsList) {
    const isCredit = transaction.type === 'credit'
    if (transaction.type !== 'debit' && !isCredit) continue

    const categoryName = transaction.category?.name ?? 'Uncategorized'
    const categoryId = transaction.category?.id ?? null
    const categoryColor = transaction.category?.color ?? null
    const rawType = transaction.category?.type ?? (isCredit ? 'income' : 'expense')

    const upperDesc = (transaction.description || '').toUpperCase()
    const isPaymentTransfer = isCredit && (
      upperDesc.includes('PAYMENT RECEIVED') ||
      upperDesc.includes('BBPS') ||
      upperDesc.includes('AUTOPAY') ||
      upperDesc.includes('AUTO DEBIT') ||
      upperDesc.includes('BILLDESK') ||
      upperDesc.includes('NEFT') ||
      upperDesc.includes('IMPS') ||
      upperDesc.includes('UPI') ||
      upperDesc.includes('CHEQUE PAYMENT')
    )

    const categoryType = isPaymentTransfer ? 'transfer' : rawType

    // Internal transfers (such as credit card bill payments and account settlements)
    // are balance movements, not living spending, investments, or owner shares.
    if (categoryType === 'transfer') continue

    const isInvestment = categoryType === 'investment'
    const isOneTime = Boolean(transaction.isOneTime)

    const totalTxnAmount = Math.abs(parseFloat(transaction.amount))
    const allocatedSum = (transaction.owners || []).reduce(
      (sum, o) => sum + Math.abs(parseFloat(o.amount)),
      0
    )
    const unallocatedAmount = Math.max(0, totalTxnAmount - allocatedSum)

    const effectiveOwners: InvoiceOwnerSnapshot[] = [...(transaction.owners || [])]
    if (effectiveOwners.length === 0 || unallocatedAmount > 0.005) {
      const remainder = effectiveOwners.length === 0 ? totalTxnAmount : unallocatedAmount
      const percentage =
        totalTxnAmount > 0 ? ((remainder / totalTxnAmount) * 100).toFixed(2) : '100'
      effectiveOwners.push({
        ownerId: null,
        name: 'Unassigned',
        color: '#71717a',
        amount: remainder.toFixed(2),
        percentage,
      })
    }

    for (const owner of effectiveOwners) {
      const ownerKey = owner.ownerId ?? 'unassigned'
      const amount = Math.abs(parseFloat(owner.amount))
      const isExpenseRefund = isCredit && categoryType === 'expense' && categoryName.toLowerCase() !== 'uncategorized' && categoryId !== null
      const adjustedAmount = isCredit ? (isExpenseRefund ? -amount : 0) : amount

      if (!ownerTotals.has(ownerKey)) {
        ownerTotals.set(ownerKey, {
          ownerId: owner.ownerId,
          name: owner.name,
          color: owner.color,
          total: 0,
          spendingTotal: 0,
          regularSpendingTotal: 0,
          oneTimeSpendingTotal: 0,
          investmentTotal: 0,
          regularInvestmentTotal: 0,
          oneTimeInvestmentTotal: 0,
          categories: new Map(),
        })
      }

      const ownerBucket = ownerTotals.get(ownerKey)!
      ownerBucket.total += adjustedAmount

      if (isInvestment) {
        ownerBucket.investmentTotal += adjustedAmount
        if (isOneTime) {
          ownerBucket.oneTimeInvestmentTotal += adjustedAmount
        } else {
          ownerBucket.regularInvestmentTotal += adjustedAmount
        }
      } else {
        ownerBucket.spendingTotal += adjustedAmount
        if (isOneTime) {
          ownerBucket.oneTimeSpendingTotal += adjustedAmount
        } else {
          ownerBucket.regularSpendingTotal += adjustedAmount
        }
      }

      const categoryKey = `${categoryId ?? 'uncategorized'}:${categoryName}`
      if (!ownerBucket.categories.has(categoryKey)) {
        ownerBucket.categories.set(categoryKey, {
          categoryId,
          category: categoryName,
          color: categoryColor,
          type: categoryType,
          total: 0,
          regularTotal: 0,
          oneTimeTotal: 0,
        })
      }

      const ownerCat = ownerBucket.categories.get(categoryKey)!
      ownerCat.total += adjustedAmount
      if (isOneTime) {
        ownerCat.oneTimeTotal += adjustedAmount
      } else {
        ownerCat.regularTotal += adjustedAmount
      }

      // Calculate overall category totals from owner-allocated shares
      if (!categoryTotalsMap.has(categoryKey)) {
        categoryTotalsMap.set(categoryKey, {
          categoryId,
          category: categoryName,
          color: categoryColor,
          type: categoryType,
          total: 0,
          regularTotal: 0,
          oneTimeTotal: 0,
        })
      }
      const overallCat = categoryTotalsMap.get(categoryKey)!
      overallCat.total += adjustedAmount
      if (isOneTime) {
        overallCat.oneTimeTotal += adjustedAmount
      } else {
        overallCat.regularTotal += adjustedAmount
      }
    }
  }

  const ownerBreakdown = Array.from(ownerTotals.values())
    .map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
      spendingTotal: owner.spendingTotal,
      regularSpendingTotal: owner.regularSpendingTotal,
      oneTimeSpendingTotal: owner.oneTimeSpendingTotal,
      investmentTotal: owner.investmentTotal,
      regularInvestmentTotal: owner.regularInvestmentTotal,
      oneTimeInvestmentTotal: owner.oneTimeInvestmentTotal,
      categories: Array.from(owner.categories.values()).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => {
      if (a.ownerId === null && b.ownerId !== null) return 1
      if (a.ownerId !== null && b.ownerId === null) return -1
      return b.total - a.total
    })

  const categoryTotals = Array.from(categoryTotalsMap.values())
    .sort((a, b) => b.total - a.total)

  const totalSpend = ownerBreakdown.reduce((acc, o) => acc + o.spendingTotal, 0)
  const regularSpend = ownerBreakdown.reduce((acc, o) => acc + o.regularSpendingTotal, 0)
  const oneTimeSpend = ownerBreakdown.reduce((acc, o) => acc + o.oneTimeSpendingTotal, 0)
  const totalInvestments = ownerBreakdown.reduce((acc, o) => acc + o.investmentTotal, 0)
  const regularInvestments = ownerBreakdown.reduce((acc, o) => acc + o.regularInvestmentTotal, 0)
  const oneTimeInvestments = ownerBreakdown.reduce((acc, o) => acc + o.oneTimeInvestmentTotal, 0)
  const totalOutflow = ownerBreakdown.reduce((acc, o) => acc + o.total, 0)

  return {
    totalSpend,
    regularSpend,
    oneTimeSpend,
    totalInvestments,
    regularInvestments,
    oneTimeInvestments,
    totalOutflow,
    ownerTotals: ownerBreakdown.map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
      spendingTotal: owner.spendingTotal,
      regularSpendingTotal: owner.regularSpendingTotal,
      oneTimeSpendingTotal: owner.oneTimeSpendingTotal,
      investmentTotal: owner.investmentTotal,
      regularInvestmentTotal: owner.regularInvestmentTotal,
      oneTimeInvestmentTotal: owner.oneTimeInvestmentTotal,
    })),
    ownerCategoryTotals: ownerBreakdown,
    categoryTotals,
  }
}

async function loadInvoice(userId: string, invoiceId: string) {
  return db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)),
    with: {
      statements: {
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
  })
}

async function validateStatementsForInvoice(
  userId: string,
  statementIds: string[],
  invoiceMonth: string
) {
  const normalizedMonth = normalizeInvoiceMonth(invoiceMonth)

  const rows = await db.query.statements.findMany({
    where: and(eq(statements.userId, userId), inArray(statements.id, statementIds)),
    with: {
      account: {
        columns: {
          id: true,
          accountName: true,
          accountType: true,
        },
      },
    },
  })

  if (rows.length !== statementIds.length) {
    return {
      ok: false as const,
      message: 'One or more selected statements could not be found',
    }
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = statementIds.map((statementId) => byId.get(statementId)!).filter(Boolean)

  const invalidStatement = ordered.find((statement) => monthKey(statement.statementMonth) !== monthKey(normalizedMonth))
  if (invalidStatement) {
    return {
      ok: false as const,
      message: 'Selected statements must all belong to the chosen invoice month',
    }
  }

  return {
    ok: true as const,
    invoiceMonth: normalizedMonth,
    statements: ordered,
  }
}

async function loadLiveTransactions(userId: string, statementIds: string[]) {
  if (statementIds.length === 0) return []

  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), inArray(transactions.statementId, statementIds)),
    orderBy: [asc(transactions.date), asc(transactions.createdAt), asc(transactions.id)],
    with: {
      category: {
        columns: {
          id: true,
          name: true,
          color: true,
          type: true,
        },
      },
      transactionOwners: {
        with: {
          owner: {
            columns: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  })

  return rows.map<InvoiceTransactionPayload>((row) => ({
    id: row.id,
    statementId: row.statementId,
    date: row.date,
    description: row.description,
    amount: amountString(Math.abs(parseFloat(row.amount))),
    type: row.type,
    isOneTime: Boolean(row.isOneTime),
    categoryId: row.categoryId,
    category: row.category
      ? {
        id: row.category.id,
        name: row.category.name,
        color: row.category.color,
        type: row.category.type,
      }
      : null,
    owners: row.transactionOwners.map((item) => ({
      ownerId: item.ownerId,
      name: item.owner.name,
      color: item.owner.color,
      amount: amountString(Math.abs(parseFloat(item.amount))),
      percentage: amountString(item.percentage),
    })),
  }))
}

function serializeInvoiceSummary(invoice: InvoiceWithStatements) {
  return {
    id: invoice.id,
    name: invoice.name,
    status: invoice.status,
    invoiceMonth: invoice.invoiceMonth,
    generatedAt: invoice.generatedAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    statements: invoice.statements.map((statement) => ({
      id: statement.id,
      statementId: statement.statementId,
      accountId: statement.accountId,
      statementMonth: statement.statementMonth,
      accountName: statement.accountName,
      accountType: statement.accountType,
    })),
  }
}

invoicesRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const data = await db.query.invoices.findMany({
    where: eq(invoices.userId, userId),
    orderBy: [desc(invoices.generatedAt), desc(invoices.updatedAt), desc(invoices.createdAt)],
    with: {
      statements: {
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
  })

  return c.json({ success: true, data: data.map(serializeInvoiceSummary) })
})

invoicesRoute.post('/', zValidator('json', createInvoiceSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const validated = await validateStatementsForInvoice(userId, body.statementIds, body.invoiceMonth)
  if (!validated.ok) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: validated.message } },
      400
    )
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      userId,
      name: body.name.trim(),
      invoiceMonth: validated.invoiceMonth,
      status: 'draft',
    })
    .returning()

  if (!invoice) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invoice' } },
      500
    )
  }

  await db.insert(invoiceStatements).values(
    validated.statements.map((statement) => ({
      invoiceId: invoice.id,
      statementId: statement.id,
      accountId: statement.accountId,
      statementMonth: validated.invoiceMonth,
      accountName: statement.account.accountName,
      accountType: statement.account.accountType,
    }))
  )

  const created = await loadInvoice(userId, invoice.id)

  if (!created) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load created invoice' } },
      500
    )
  }

  return c.json({ success: true, data: serializeInvoiceSummary(created) }, 201)
})

invoicesRoute.patch('/:id', zValidator('json', updateInvoiceSchema), async (c) => {
  const userId = c.get('userId')
  const invoiceId = c.req.param('id')
  const body = c.req.valid('json')

  const invoice = await loadInvoice(userId, invoiceId)
  if (!invoice) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    )
  }

  if (invoice.status !== 'draft') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Generated invoices cannot be edited' } },
      400
    )
  }

  if (body.statementIds) {
    const validated = await validateStatementsForInvoice(userId, body.statementIds, String(invoice.invoiceMonth))
    if (!validated.ok) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: validated.message } },
        400
      )
    }

    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({
          ...(body.name ? { name: body.name.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))

      await tx.delete(invoiceStatements).where(eq(invoiceStatements.invoiceId, invoiceId))
      await tx.insert(invoiceStatements).values(
        validated.statements.map((statement) => ({
          invoiceId,
          statementId: statement.id,
          accountId: statement.accountId,
          statementMonth: normalizeInvoiceMonth(String(invoice.invoiceMonth)),
          accountName: statement.account.accountName,
          accountType: statement.account.accountType,
        }))
      )
    })
  } else if (body.name) {
    await db
      .update(invoices)
      .set({
        name: body.name.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
  }

  const updated = await loadInvoice(userId, invoiceId)
  if (!updated) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load updated invoice' } },
      500
    )
  }

  return c.json({ success: true, data: serializeInvoiceSummary(updated) })
})

invoicesRoute.post('/:id/generate', async (c) => {
  const userId = c.get('userId')
  const invoiceId = c.req.param('id')

  const invoice = await loadInvoice(userId, invoiceId)
  if (!invoice) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    )
  }

  if (invoice.status !== 'draft') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invoice has already been generated' } },
      400
    )
  }

  if (invoice.statements.some((statement) => !statement.statementId)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'One or more selected statements are no longer available for generation',
        },
      },
      400
    )
  }

  const selectedStatementIds = invoice.statements
    .map((statement) => statement.statementId)
    .filter((statementId): statementId is string => Boolean(statementId))

  const liveTransactions = await loadLiveTransactions(userId, selectedStatementIds)
  if (liveTransactions.length === 0) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'No transactions found for this invoice' } },
      400
    )
  }

  await db.transaction(async (tx) => {
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))

    await tx.insert(invoiceItems).values(
      liveTransactions.map((transaction) => ({
        invoiceId,
        transactionId: transaction.id,
        statementId: transaction.statementId,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        isOneTime: transaction.isOneTime,
        categoryId: transaction.categoryId,
        categoryName: transaction.category?.name ?? 'Uncategorized',
        categoryColor: transaction.category?.color ?? null,
        categoryType: transaction.category?.type ?? 'expense',
        owners: transaction.owners,
      }))
    )

    await tx
      .update(invoices)
      .set({
        status: 'generated',
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
  })

  const generated = await loadInvoice(userId, invoiceId)
  if (!generated) {
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load generated invoice' },
      },
      500
    )
  }

  return c.json({ success: true, data: serializeInvoiceSummary(generated) })
})

invoicesRoute.post('/:id/draft', async (c) => {
  const userId = c.get('userId')
  const invoiceId = c.req.param('id')

  const invoice = await loadInvoice(userId, invoiceId)
  if (!invoice) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    )
  }

  if (invoice.status !== 'generated') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invoice is already in draft status' } },
      400
    )
  }

  await db.transaction(async (tx) => {
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))

    await tx
      .update(invoices)
      .set({
        status: 'draft',
        generatedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
  })

  const updated = await loadInvoice(userId, invoiceId)
  if (!updated) {
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load updated invoice' },
      },
      500
    )
  }

  return c.json({ success: true, data: serializeInvoiceSummary(updated) })
})

invoicesRoute.get('/:id', async (c) => {
  const userId = c.get('userId')
  const invoiceId = c.req.param('id')

  const invoice = await loadInvoice(userId, invoiceId)
  if (!invoice) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    )
  }

  if (invoice.status === 'draft') {
    const selectedStatementIds = invoice.statements
      .map((statement) => statement.statementId)
      .filter((statementId): statementId is string => Boolean(statementId))
    const liveTransactions = await loadLiveTransactions(userId, selectedStatementIds)

    return c.json({
      success: true,
      data: {
        ...serializeInvoiceSummary(invoice),
        transactions: liveTransactions,
        analysis: buildAnalysis(liveTransactions),
      },
    })
  }

  const items = await db.query.invoiceItems.findMany({
    where: eq(invoiceItems.invoiceId, invoiceId),
    orderBy: [asc(invoiceItems.date), asc(invoiceItems.createdAt), asc(invoiceItems.id)],
  })

  const snapshotTransactions: InvoiceTransactionPayload[] = items.map((item) => ({
    id: item.id,
    statementId: item.statementId,
    date: item.date,
    description: item.description,
    amount: amountString(Math.abs(parseFloat(item.amount))),
    type: item.type,
    isOneTime: Boolean(item.isOneTime),
    categoryId: item.categoryId,
    category: {
      id: item.categoryId,
      name: item.categoryName,
      color: item.categoryColor,
      type: item.categoryType,
    },
    owners: (item.owners || []).map((o) => ({
      ...o,
      amount: amountString(Math.abs(parseFloat(o.amount))),
    })),
  }))

  return c.json({
    success: true,
    data: {
      ...serializeInvoiceSummary(invoice),
      transactions: snapshotTransactions,
      analysis: buildAnalysis(snapshotTransactions),
    },
  })
})

invoicesRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const invoiceId = c.req.param('id')

  const [deleted] = await db
    .delete(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .returning()

  if (!deleted) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      404
    )
  }

  return c.json({ success: true, data: null })
})

import { Hono } from 'hono'
import { db } from '@momoney/db'
import { categorizationRules, categories, transactions } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull, or, desc, sql } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const rulesRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

rulesRoute.use('*', authMiddleware)

const insertRuleSchema = z.object({
  matchField: z.enum(['merchant', 'description', 'amount']),
  matchType: z.enum(['contains', 'equals', 'regex', 'gt', 'lt']),
  matchValue: z.string().min(1).refine(v => v.trim().length > 0, { message: 'matchValue cannot be blank' }),
  categoryId: z.string().uuid(),
  priority: z.number().int().min(1).max(9999).default(100),
})

const updateRuleSchema = z.object({
  matchField: z.enum(['merchant', 'description', 'amount']).optional(),
  matchType: z.enum(['contains', 'equals', 'regex', 'gt', 'lt']).optional(),
  matchValue: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(9999).optional(),
  isActive: z.boolean().optional(),
})

const previewRuleSchema = z.object({
  matchField: z.enum(['merchant', 'description', 'amount']),
  matchType: z.enum(['contains', 'equals', 'regex', 'gt', 'lt']),
  matchValue: z.string().min(1),
  categoryId: z.string().uuid(),
})

rulesRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const data = await db.query.categorizationRules.findMany({
    where: or(
      eq(categorizationRules.userId, userId),
      isNull(categorizationRules.userId)
    ),
    with: {
      category: true,
    },
    orderBy: (table, { asc, desc }) => [
      desc(table.source),
      asc(table.priority),
    ],
  })

  return c.json({ success: true, data })
})

rulesRoute.post('/', zValidator('json', insertRuleSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [rule] = await db
    .insert(categorizationRules)
    .values({
      userId,
      matchField: body.matchField,
      matchType: body.matchType,
      matchValue: body.matchValue.trim(),
      categoryId: body.categoryId,
      priority: body.priority,
      source: 'user',
      isActive: true,
    })
    .returning()

  if (!rule) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rule' } },
      500
    )
  }

  const ruleWithCategory = await db.query.categorizationRules.findFirst({
    where: eq(categorizationRules.id, rule.id),
    with: {
      category: true,
    },
  })

  return c.json({ success: true, data: ruleWithCategory }, 201)
})

rulesRoute.patch('/:id', zValidator('json', updateRuleSchema), async (c) => {
  const userId = c.get('userId')
  const ruleId = c.req.param('id')
  const body = c.req.valid('json')

  const existing = await db.query.categorizationRules.findFirst({
    where: and(
      eq(categorizationRules.id, ruleId),
      or(
        eq(categorizationRules.userId, userId),
        isNull(categorizationRules.userId)
      )
    ),
  })

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      404
    )
  }

  const [rule] = await db
    .update(categorizationRules)
    .set({
      ...(body.matchField ? { matchField: body.matchField } : {}),
      ...(body.matchType ? { matchType: body.matchType } : {}),
      ...(body.matchValue ? { matchValue: body.matchValue.trim() } : {}),
      ...(body.categoryId ? { categoryId: body.categoryId } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(categorizationRules.id, ruleId))
    .returning()

  if (!rule) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      404
    )
  }

  const ruleWithCategory = await db.query.categorizationRules.findFirst({
    where: eq(categorizationRules.id, rule.id),
    with: {
      category: true,
    },
  })

  return c.json({ success: true, data: ruleWithCategory })
})

rulesRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const ruleId = c.req.param('id')

  const existing = await db.query.categorizationRules.findFirst({
    where: and(
      eq(categorizationRules.id, ruleId),
      or(
        eq(categorizationRules.userId, userId),
        isNull(categorizationRules.userId)
      )
    ),
  })

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
      404
    )
  }

  await db
    .delete(categorizationRules)
    .where(eq(categorizationRules.id, ruleId))

  return c.json({ success: true, data: null })
})

rulesRoute.post('/preview', zValidator('json', previewRuleSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  let whereClause = and(
    eq(transactions.userId, userId),
    eq(transactions.categoryId, body.categoryId)
  )

  if (body.matchField === 'description') {
    if (body.matchType === 'contains') {
      whereClause = and(
        eq(transactions.userId, userId),
        sql`LOWER(${transactions.description}) LIKE ${'%' + body.matchValue.toLowerCase() + '%'}`
      )
    } else if (body.matchType === 'equals') {
      whereClause = and(
        eq(transactions.userId, userId),
        sql`LOWER(${transactions.description}) = ${body.matchValue.toLowerCase()}`
      )
    }
  }

  const matchingTransactions = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
    })
    .from(transactions)
    .where(whereClause)
    .limit(10)

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(whereClause)

  return c.json({
    success: true,
    data: {
      count: countResult[0]?.count || 0,
      samples: matchingTransactions,
    },
  })
})

rulesRoute.post('/reapply', async (c) => {
  const userId = c.get('userId')

  const userRules = await db.query.categorizationRules.findMany({
    where: or(
      eq(categorizationRules.userId, userId),
      isNull(categorizationRules.userId)
    ),
    orderBy: (table, { asc, desc }) => [
      desc(table.source),
      asc(table.priority),
    ],
  })

  const allCategories = await db.query.categories.findMany({
    where: or(
      eq(categories.userId, userId),
      isNull(categories.userId)
    ),
  })

  const categoryMap = new Map(allCategories.map((cat) => [cat.id, cat]))

  const uncategorizedTransactions = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      merchant: transactions.merchant,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.categoryId} IS NULL OR ${transactions.categoryId} IN (
          SELECT id FROM categories WHERE name = 'Uncategorized'
        )`
      )
    )

  let updatedCount = 0

  for (const txn of uncategorizedTransactions) {
    for (const rule of userRules) {
      if (!rule.isActive) continue

      let matches = false
      const value =
        rule.matchField === 'merchant'
          ? txn.merchant || ''
          : rule.matchField === 'description'
          ? txn.description
          : ''

      if (!value) continue
      if (!rule.matchValue || !rule.matchValue.trim()) continue

      const upperValue = value.toUpperCase()
      const upperMatch = rule.matchValue.toUpperCase()

      switch (rule.matchType) {
        case 'contains':
          matches = upperValue.includes(upperMatch)
          break
        case 'equals':
          matches = upperValue === upperMatch
          break
        case 'regex':
          try {
            const regex = new RegExp(rule.matchValue, 'i')
            matches = regex.test(value)
          } catch {
            matches = false
          }
          break
      }

      if (matches) {
        await db
          .update(transactions)
          .set({ categoryId: rule.categoryId, updatedAt: new Date() })
          .where(eq(transactions.id, txn.id))
        updatedCount++
        break
      }
    }
  }

  return c.json({
    success: true,
    data: { updatedCount },
  })
})

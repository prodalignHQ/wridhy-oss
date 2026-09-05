import { Hono } from 'hono'
import { db, categories, transactions, categorizationRules, merchants, invoiceItems } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull, or, count } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const categoriesRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

categoriesRoute.use('*', authMiddleware)

export function isProtectedCategory(cat: { name: string; type?: string | null; isSystem: boolean }): boolean {
  if (!cat.isSystem) return false
  const lowerName = cat.name.trim().toLowerCase()
  return (
    lowerName === 'income' ||
    lowerName === 'investments' ||
    lowerName === 'investment' ||
    lowerName === 'transfers' ||
    lowerName === 'transfer' ||
    lowerName === 'uncategorized' ||
    cat.type === 'income' ||
    cat.type === 'investment' ||
    cat.type === 'transfer'
  )
}

const insertCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['expense', 'investment', 'income', 'transfer']).default('expense'),
  icon: z.string().nullable().optional(),
  color: z.string().min(1).default('#6366f1'),
})

const updateCategorySchema = insertCategorySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required'
)

categoriesRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const data = await db.query.categories.findMany({
    where: or(eq(categories.userId, userId), isNull(categories.userId)),
    orderBy: (table, { desc, asc }) => [desc(table.isSystem), asc(table.name)],
  })

  return c.json({ success: true, data })
})

categoriesRoute.get('/:id/usage', async (c) => {
  const userId = c.get('userId')
  const categoryId = c.req.param('id')

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, categoryId),
      or(eq(categories.userId, userId), isNull(categories.userId))
    ),
  })

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    )
  }

  const [txCountResult] = await db
    .select({ count: count() })
    .from(transactions)
    .where(and(eq(transactions.categoryId, categoryId), eq(transactions.userId, userId)))

  const [ruleCountResult] = await db
    .select({ count: count() })
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.categoryId, categoryId),
        or(eq(categorizationRules.userId, userId), isNull(categorizationRules.userId))
      )
    )

  return c.json({
    success: true,
    data: {
      id: category.id,
      name: category.name,
      transactionCount: Number(txCountResult?.count ?? 0),
      ruleCount: Number(ruleCountResult?.count ?? 0),
      isSystem: category.isSystem,
      isProtected: isProtectedCategory(category),
    },
  })
})

categoriesRoute.post('/', zValidator('json', insertCategorySchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [category] = await db
    .insert(categories)
    .values({
      userId,
      name: body.name.trim(),
      type: body.type ?? 'expense',
      icon: body.icon ?? null,
      color: body.color,
      isSystem: false,
    })
    .returning()

  return c.json({ success: true, data: category }, 201)
})

categoriesRoute.patch('/:id', zValidator('json', updateCategorySchema), async (c) => {
  const userId = c.get('userId')
  const categoryId = c.req.param('id')
  const body = c.req.valid('json')

  const [category] = await db
    .update(categories)
    .set({
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.type ? { type: body.type } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.color ? { color: body.color } : {}),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .returning()

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    )
  }

  return c.json({ success: true, data: category })
})

categoriesRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const categoryId = c.req.param('id')

  let moveToCategoryId: string | null | undefined = undefined
  try {
    const contentType = c.req.header('content-type')
    if (contentType && contentType.includes('application/json')) {
      const body = await c.req.json()
      moveToCategoryId = body?.moveToCategoryId
    }
  } catch {
    // Ignore JSON parse errors for DELETE
  }

  if (moveToCategoryId === undefined) {
    const queryTarget = c.req.query('moveToCategoryId')
    if (queryTarget !== undefined) {
      moveToCategoryId = queryTarget === '' || queryTarget === 'null' ? null : queryTarget
    }
  }

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, categoryId),
      or(eq(categories.userId, userId), isNull(categories.userId))
    ),
  })

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    )
  }

  if (isProtectedCategory(category)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Core system category "${category.name}" cannot be deleted as it is required for accounting and system reports.`,
        },
      },
      400
    )
  }

  // Check transaction count for this user
  const [txCountResult] = await db
    .select({ count: count() })
    .from(transactions)
    .where(and(eq(transactions.categoryId, categoryId), eq(transactions.userId, userId)))

  const transactionCount = Number(txCountResult?.count ?? 0)

  if (transactionCount > 0 && moveToCategoryId === undefined) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CATEGORY_IN_USE',
          message: `Category "${category.name}" has ${transactionCount} transactions assigned. Please choose a category to remap them to.`,
          transactionCount,
        },
      },
      409
    )
  }

  if (moveToCategoryId && moveToCategoryId === categoryId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TARGET',
          message: 'Cannot remap transactions to the category being deleted.',
        },
      },
      400
    )
  }

  // Find uncategorized fallback if needed
  let finalTargetId: string | null = null
  if (moveToCategoryId) {
    const targetCategory = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, moveToCategoryId),
        or(eq(categories.userId, userId), isNull(categories.userId))
      ),
    })

    if (!targetCategory) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Target category not found' },
        },
        400
      )
    }
    finalTargetId = targetCategory.id
  } else if (moveToCategoryId === null) {
    // Explicitly requested to uncategorize
    const uncategorized = await db.query.categories.findFirst({
      where: and(
        eq(categories.name, 'Uncategorized'),
        isNull(categories.userId)
      ),
    })
    finalTargetId = uncategorized?.id ?? null
  }

  await db.transaction(async (tx) => {
    // 1. Reassign transactions
    await tx
      .update(transactions)
      .set({ categoryId: finalTargetId, updatedAt: new Date() })
      .where(and(eq(transactions.categoryId, categoryId), eq(transactions.userId, userId)))

    // 2. Reassign invoice items
    await tx
      .update(invoiceItems)
      .set({ categoryId: finalTargetId })
      .where(eq(invoiceItems.categoryId, categoryId))

    // 3. Reassign or delete categorization rules
    if (finalTargetId) {
      await tx
        .update(categorizationRules)
        .set({ categoryId: finalTargetId, updatedAt: new Date() })
        .where(eq(categorizationRules.categoryId, categoryId))
    } else {
      // categorizationRules.categoryId has a NOT NULL constraint, so delete rules pointing to this category
      await tx
        .delete(categorizationRules)
        .where(eq(categorizationRules.categoryId, categoryId))
    }

    // 4. Update merchants
    await tx
      .update(merchants)
      .set({ defaultCategoryId: finalTargetId })
      .where(eq(merchants.defaultCategoryId, categoryId))

    // 5. Update child categories parentId
    await tx
      .update(categories)
      .set({ parentId: null })
      .where(eq(categories.parentId, categoryId))

    // 6. Delete category
    await tx
      .delete(categories)
      .where(eq(categories.id, categoryId))
  })

  return c.json({
    success: true,
    data: {
      deletedCategoryId: categoryId,
      remappedToCategoryId: finalTargetId,
      remappedTransactionsCount: transactionCount,
    },
  })
})

import { Hono } from 'hono'
import { db } from '@momoney/db'
import { categories } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull, or } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const categoriesRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

categoriesRoute.use('*', authMiddleware)

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

  const [category] = await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .returning()

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    )
  }

  return c.json({ success: true, data: null })
})

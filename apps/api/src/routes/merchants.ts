import { Hono } from 'hono'
import { db } from '@momoney/db'
import { merchants, categories } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNull, or } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const merchantsRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

merchantsRoute.use('*', authMiddleware)

const insertMerchantSchema = z.object({
  rawPatterns: z.array(z.string()).min(1),
  normalizedName: z.string().min(1),
  defaultCategoryId: z.string().uuid().nullable().optional(),
})

const updateMerchantSchema = z.object({
  rawPatterns: z.array(z.string()).min(1).optional(),
  normalizedName: z.string().min(1).optional(),
  defaultCategoryId: z.string().uuid().nullable().optional(),
})

merchantsRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const data = await db.query.merchants.findMany({
    where: or(
      eq(merchants.userId, userId),
      isNull(merchants.userId)
    ),
    with: {
      defaultCategory: true,
    },
    orderBy: (table, { desc, asc }) => [
      desc(table.isSystem),
      asc(table.normalizedName),
    ],
  })

  return c.json({ success: true, data })
})

merchantsRoute.post('/', zValidator('json', insertMerchantSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [merchant] = await db
    .insert(merchants)
    .values({
      userId,
      rawPatterns: body.rawPatterns.map((p) => p.trim()),
      normalizedName: body.normalizedName.trim(),
      defaultCategoryId: body.defaultCategoryId ?? null,
      isSystem: false,
    })
    .returning()

  if (!merchant) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create merchant' } },
      500
    )
  }

  const merchantWithCategory = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchant.id),
    with: {
      defaultCategory: true,
    },
  })

  return c.json({ success: true, data: merchantWithCategory }, 201)
})

merchantsRoute.patch('/:id', zValidator('json', updateMerchantSchema), async (c) => {
  const userId = c.get('userId')
  const merchantId = c.req.param('id')
  const body = c.req.valid('json')

  const existing = await db.query.merchants.findFirst({
    where: and(
      eq(merchants.id, merchantId),
      eq(merchants.userId, userId)
    ),
  })

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
      404
    )
  }

  if (existing.isSystem) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify system merchants' } },
      403
    )
  }

  const [merchant] = await db
    .update(merchants)
    .set({
      ...(body.rawPatterns ? { rawPatterns: body.rawPatterns.map((p) => p.trim()) } : {}),
      ...(body.normalizedName ? { normalizedName: body.normalizedName.trim() } : {}),
      ...(body.defaultCategoryId !== undefined ? { defaultCategoryId: body.defaultCategoryId } : {}),
    })
    .where(and(eq(merchants.id, merchantId), eq(merchants.userId, userId)))
    .returning()

  if (!merchant) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
      404
    )
  }

  const merchantWithCategory = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchant.id),
    with: {
      defaultCategory: true,
    },
  })

  return c.json({ success: true, data: merchantWithCategory })
})

merchantsRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const merchantId = c.req.param('id')

  const existing = await db.query.merchants.findFirst({
    where: and(
      eq(merchants.id, merchantId),
      eq(merchants.userId, userId)
    ),
  })

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
      404
    )
  }

  if (existing.isSystem) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete system merchants' } },
      403
    )
  }

  await db
    .delete(merchants)
    .where(and(eq(merchants.id, merchantId), eq(merchants.userId, userId)))

  return c.json({ success: true, data: null })
})

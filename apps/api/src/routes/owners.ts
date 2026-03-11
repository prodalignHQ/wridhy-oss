import { Hono } from 'hono'
import { db } from '@momoney/db'
import { owners, transactionOwners } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const ownersRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

ownersRoute.use('*', authMiddleware)

const PALETTE = ['indigo', 'emerald', 'rose', 'amber', 'sky', 'violet']

const insertOwnerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['person', 'shared', 'household']).default('person'),
})

const updateOwnerSchema = z.object({
  name: z.string().min(1),
})

ownersRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const data = await db.query.owners.findMany({
    where: eq(owners.userId, userId),
    orderBy: (owners, { asc }) => [asc(owners.createdAt)],
  })
  return c.json({ success: true, data })
})

ownersRoute.post('/', zValidator('json', insertOwnerSchema), async (c) => {
  const userId = c.get('userId')
  const { name, type } = c.req.valid('json')

  // Pick a random color from the palette
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]

  const [owner] = await db
    .insert(owners)
    .values({
      userId,
      name,
      type,
      color,
      isDefault: false,
    })
    .returning()

  return c.json({ success: true, data: owner }, 201)
})

ownersRoute.patch('/:id', zValidator('json', updateOwnerSchema), async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.param('id')
  const { name } = c.req.valid('json')

  const [owner] = await db
    .update(owners)
    .set({ name })
    .where(and(eq(owners.id, ownerId), eq(owners.userId, userId)))
    .returning()

  if (!owner) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Owner not found' } }, 404)
  }

  return c.json({ success: true, data: owner })
})

ownersRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.param('id')

  // Check if owner exists and is not default
  const owner = await db.query.owners.findFirst({
    where: and(eq(owners.id, ownerId), eq(owners.userId, userId)),
  })

  if (!owner) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Owner not found' } }, 404)
  }

  if (owner.isDefault) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot delete default owner' } }, 400)
  }

  // Find the 'Self' owner for reassignment
  const selfOwner = await db.query.owners.findFirst({
    where: and(eq(owners.userId, userId), eq(owners.isDefault, true)),
  })

  if (!selfOwner) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Self owner missing' } }, 500)
  }

  // Wrap in a transaction to reassign transactions before deleting
  await db.transaction(async (tx) => {
    await tx
      .update(transactionOwners)
      .set({ ownerId: selfOwner.id })
      .where(eq(transactionOwners.ownerId, ownerId))

    await tx.delete(owners).where(eq(owners.id, ownerId))
  })

  return c.json({ success: true, data: null })
})

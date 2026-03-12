import { Hono } from 'hono'
import { db } from '@momoney/db'
import { financialAccounts } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const accountsRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

accountsRoute.use('*', authMiddleware)

const insertAccountSchema = z.object({
  accountName: z.string().min(1),
  accountType: z.enum(['bank', 'credit_card', 'wallet', 'investment']),
  bankId: z.string().min(1),
  bankName: z.string().min(1),
  currency: z.string().default('INR'),
})

const updateAccountSchema = insertAccountSchema.partial()

accountsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const accounts = await db.query.financialAccounts.findMany({
    where: and(eq(financialAccounts.userId, userId), eq(financialAccounts.isDeleted, false)),
    orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
  })
  return c.json({ success: true, data: accounts })
})

accountsRoute.post('/', zValidator('json', insertAccountSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [account] = await db
    .insert(financialAccounts)
    .values({
      ...body,
      userId,
    })
    .returning()

  return c.json({ success: true, data: account }, 201)
})

accountsRoute.patch('/:id', zValidator('json', updateAccountSchema), async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const body = c.req.valid('json')

  const [account] = await db
    .update(financialAccounts)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
    .returning()

  if (!account) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404)
  }

  return c.json({ success: true, data: account })
})

accountsRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  const [account] = await db
    .update(financialAccounts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
    .returning()

  if (!account) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404)
  }

  return c.json({ success: true, data: null })
})

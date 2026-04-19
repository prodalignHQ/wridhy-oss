import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth.js'
import { InsightsService } from '../services/insights.service.js'

export const insightsRoute = new Hono<{
  Variables: { userId: string }
}>()

insightsRoute.use('*', authMiddleware)

const insightsService = new InsightsService()

const commonQuerySchema = z.object({
  ownerIds: z.string().optional().transform(v => v ? v.split(',') : undefined),
})

// ─── GET /v1/insights/monthly ─────────────────────────────────────────────────

const monthlyQuerySchema = commonQuerySchema.extend({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
})

insightsRoute.get('/monthly', zValidator('query', monthlyQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { month, ownerIds } = c.req.valid('query')
  
  const data = await insightsService.getMonthlyInsights(userId, month, ownerIds)
  return c.json({ success: true, data })
})

// ─── GET /v1/insights/yearly ──────────────────────────────────────────────────

const yearlyQuerySchema = commonQuerySchema.extend({
  year: z.coerce.number().int(),
})

insightsRoute.get('/yearly', zValidator('query', yearlyQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { year, ownerIds } = c.req.valid('query')
  
  const data = await insightsService.getYearlyInsights(userId, year, ownerIds)
  return c.json({ success: true, data })
})

// ─── GET /v1/insights/category-comparison ──────────────────────────────────────

insightsRoute.get('/category-comparison', zValidator('query', monthlyQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { month, ownerIds } = c.req.valid('query')
  
  const data = await insightsService.getCategoryComparison(userId, month, ownerIds)
  return c.json({ success: true, data })
})

// ─── GET /v1/insights/category-averages ────────────────────────────────────────

insightsRoute.get('/category-averages', zValidator('query', monthlyQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { month, ownerIds } = c.req.valid('query')
  
  const data = await insightsService.getCategoryAverages(userId, month, ownerIds)
  return c.json({ success: true, data })
})

insightsRoute.get('/owners', (c) => c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming soon' } }, 501))

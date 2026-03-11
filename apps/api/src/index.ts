import './env.js'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { corsMiddleware } from './middleware/cors.js'
import { healthRoute } from './routes/health.js'
import { authRoute } from './routes/auth.js'
import { accountsRoute } from './routes/accounts.js'
import { ownersRoute } from './routes/owners.js'
import { statementsRoute } from './routes/statements.js'
import { transactionsRoute } from './routes/transactions.js'
import { categoriesRoute } from './routes/categories.js'
import { rulesRoute } from './routes/rules.js'
import { merchantsRoute } from './routes/merchants.js'
import { insightsRoute } from './routes/insights.js'
import { networthRoute } from './routes/networth.js'

const app = new Hono()

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use('*', corsMiddleware)
app.use('*', logger())
app.use('*', prettyJSON())

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/health', healthRoute)
app.route('/v1/auth', authRoute)
app.route('/v1/accounts', accountsRoute)
app.route('/v1/owners', ownersRoute)
app.route('/v1/statements', statementsRoute)
app.route('/v1/transactions', transactionsRoute)
app.route('/v1/categories', categoriesRoute)
app.route('/v1/rules', rulesRoute)
app.route('/v1/merchants', merchantsRoute)
app.route('/v1/insights', insightsRoute)
app.route('/v1/networth', networthRoute)

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: `Route ${c.req.path} not found` } },
    404
  )
})

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env['NODE_ENV'] === 'development' ? err.message : 'An unexpected error occurred',
      },
    },
    500
  )
})

// ─── Server ───────────────────────────────────────────────────────────────────

const port = parseInt(process.env['PORT'] ?? '3001', 10)

console.log(`🚀 MoMoney API starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
})

console.log(`✅ MoMoney API running at http://localhost:${port}`)
console.log(`   Health check: http://localhost:${port}/health`)

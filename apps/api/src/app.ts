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
import { invoicesRoute } from './routes/invoices.js'
import { vaultRoute } from './routes/vault.js'

export function createApiApp() {
  const app = new Hono()

  // ─── Global Middleware ────────────────────────────────────────────────────────

  app.use('*', corsMiddleware)
  app.use('*', logger())
  app.use('*', prettyJSON())

  // ─── Routes ───────────────────────────────────────────────────────────────────

  app.route('/health', healthRoute)
  app.route('/api/auth', authRoute)
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
  app.route('/v1/invoices', invoicesRoute)
  app.route('/v1/vault', vaultRoute)

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

  return app
}

import './env.js'

import { serve } from '@hono/node-server'
import { createApiApp } from './app.js'

const app = createApiApp()

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: `Route ${c.req.path} not found` } },
    404
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

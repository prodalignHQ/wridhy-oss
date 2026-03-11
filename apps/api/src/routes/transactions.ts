import { Hono } from 'hono'

// Stub — will be implemented in Phase 2
export const transactionsRoute = new Hono()

const notImplemented = (c: any) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } }, 501)

transactionsRoute.get('/', notImplemented)
transactionsRoute.patch('/:id', notImplemented)
transactionsRoute.put('/:id/owners', notImplemented)
transactionsRoute.get('/export', notImplemented)

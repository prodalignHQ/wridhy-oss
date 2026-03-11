import { Hono } from 'hono'

// Stub — will be implemented in Phase 5
export const networthRoute = new Hono()

const notImplemented = (c: any) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 5' } }, 501)

networthRoute.get('/', notImplemented)
networthRoute.get('/history', notImplemented)
networthRoute.post('/snapshot', notImplemented)
networthRoute.get('/assets', notImplemented)
networthRoute.post('/assets', notImplemented)
networthRoute.patch('/assets/:id', notImplemented)
networthRoute.delete('/assets/:id', notImplemented)
networthRoute.get('/liabilities', notImplemented)
networthRoute.post('/liabilities', notImplemented)
networthRoute.patch('/liabilities/:id', notImplemented)
networthRoute.delete('/liabilities/:id', notImplemented)

import { Hono } from 'hono'

// Stub — will be implemented in Phase 1
export const accountsRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof accountsRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 1' } }, 501)

accountsRoute.get('/', notImplemented)
accountsRoute.post('/', notImplemented)
accountsRoute.patch('/:id', notImplemented)
accountsRoute.delete('/:id', notImplemented)

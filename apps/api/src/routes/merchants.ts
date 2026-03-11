import { Hono } from 'hono'

// Stub — will be implemented in Phase 3
export const merchantsRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof merchantsRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } }, 501)

merchantsRoute.get('/', notImplemented)
merchantsRoute.post('/', notImplemented)
merchantsRoute.patch('/:id', notImplemented)
merchantsRoute.delete('/:id', notImplemented)

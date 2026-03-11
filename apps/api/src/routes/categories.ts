import { Hono } from 'hono'

// Stub — will be implemented in Phase 3
export const categoriesRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof categoriesRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } }, 501)

categoriesRoute.get('/', notImplemented)
categoriesRoute.post('/', notImplemented)
categoriesRoute.patch('/:id', notImplemented)
categoriesRoute.delete('/:id', notImplemented)

import { Hono } from 'hono'

// Stub — will be implemented in Phase 1
export const ownersRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof ownersRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 1' } }, 501)

ownersRoute.get('/', notImplemented)
ownersRoute.post('/', notImplemented)
ownersRoute.patch('/:id', notImplemented)
ownersRoute.delete('/:id', notImplemented)

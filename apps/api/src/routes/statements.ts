import { Hono } from 'hono'

// Stub — will be implemented in Phase 2
export const statementsRoute = new Hono()

const notImplemented = (c: any) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } }, 501)

statementsRoute.post('/upload', notImplemented)
statementsRoute.get('/', notImplemented)
statementsRoute.delete('/:id', notImplemented)

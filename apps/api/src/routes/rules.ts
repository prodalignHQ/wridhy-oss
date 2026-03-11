import { Hono } from 'hono'

// Stub — will be implemented in Phase 3
export const rulesRoute = new Hono()

const notImplemented = (c: any) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } }, 501)

rulesRoute.get('/', notImplemented)
rulesRoute.post('/', notImplemented)
rulesRoute.patch('/:id', notImplemented)
rulesRoute.delete('/:id', notImplemented)
rulesRoute.post('/preview', notImplemented)

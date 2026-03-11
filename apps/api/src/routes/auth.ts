import { Hono } from 'hono'

// Stub — will be implemented in Phase 1
export const authRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof authRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 1' } }, 501)

authRoute.post('/signup', notImplemented)
authRoute.post('/login', notImplemented)
authRoute.post('/logout', notImplemented)
authRoute.post('/refresh', notImplemented)

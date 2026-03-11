import { Hono } from 'hono'

// Stub — will be implemented in Phase 4
export const insightsRoute = new Hono()

const notImplemented = (c: Parameters<Parameters<typeof insightsRoute.get>[1]>[0]) =>
  c.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 4' } }, 501)

insightsRoute.get('/monthly', notImplemented)
insightsRoute.get('/yearly', notImplemented)
insightsRoute.get('/categories', notImplemented)
insightsRoute.get('/merchants', notImplemented)
insightsRoute.get('/owners', notImplemented)

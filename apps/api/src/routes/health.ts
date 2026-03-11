import { Hono } from 'hono'

export const healthRoute = new Hono()

healthRoute.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  })
})

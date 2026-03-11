import { Hono } from 'hono'
import { auth } from '@momoney/db/auth'

export const authRoute = new Hono()

authRoute.on(['POST', 'GET'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

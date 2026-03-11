import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

export const corsMiddleware: MiddlewareHandler = cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})

import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('[::1]') ||
      process.env['MOMONEY_LOCAL_MODE'] === 'true'
    ) {
      return origin
    }
    return origin
  },
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
})

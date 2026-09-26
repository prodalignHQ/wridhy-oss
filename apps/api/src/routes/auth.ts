import { Hono } from 'hono'
import { auth } from '@momoney/db/auth'
import { isSqlite } from '@momoney/db'
import { ensureLocalUserAndSeed, LOCAL_USER_ID, LOCAL_USER_EMAIL } from '@momoney/db/local-seed'

export const authRoute = new Hono()

authRoute.get('/get-session', async (c) => {
  const res = await auth.handler(c.req.raw)
  if (res.ok) {
    const data = (await res.clone().json().catch(() => null)) as any
    if (data?.user && data?.session) {
      return res
    }
  }

  if (isSqlite || process.env['MOMONEY_LOCAL_MODE'] === 'true') {
    await ensureLocalUserAndSeed()
    return c.json({
      user: {
        id: LOCAL_USER_ID,
        email: LOCAL_USER_EMAIL,
        name: 'Local User',
        emailVerified: true,
      },
      session: {
        id: 'local-session',
        userId: LOCAL_USER_ID,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
  }

  return res
})

authRoute.on(['POST', 'GET'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

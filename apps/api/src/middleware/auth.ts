import { createMiddleware } from 'hono/factory'
import { auth } from '@momoney/db/auth'
import { isSqlite } from '@momoney/db'
import { ensureLocalUserAndSeed, LOCAL_USER_ID, LOCAL_USER_EMAIL } from '@momoney/db/local-seed'

type AuthEnv = {
  Variables: {
    user: any
    session: any
    userId: string
  }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    if (isSqlite || process.env['MOMONEY_LOCAL_MODE'] === 'true') {
      await ensureLocalUserAndSeed()
      const localUser = {
        id: LOCAL_USER_ID,
        email: LOCAL_USER_EMAIL,
        name: 'Local User',
        emailVerified: true,
      }
      c.set('user', localUser)
      c.set('session', {
        id: 'local-session',
        userId: LOCAL_USER_ID,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      c.set('userId', LOCAL_USER_ID)
      return next()
    }

    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401
    )
  }

  if (!session.user.emailVerified && process.env['MOMONEY_LOCAL_MODE'] !== 'true' && !isSqlite) {
    return c.json(
      {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Verify your email before using the app',
        },
      },
      403
    )
  }

  c.set('user', session.user)
  c.set('session', session.session)
  c.set('userId', session.user.id)
  
  await next()
})

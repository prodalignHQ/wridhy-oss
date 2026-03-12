import { createMiddleware } from 'hono/factory'
import { auth } from '@momoney/db/auth'

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
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401
    )
  }

  if (!session.user.emailVerified) {
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

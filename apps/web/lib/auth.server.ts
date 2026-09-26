import { cookies } from 'next/headers'

type AuthSession = {
  session: {
    id: string
    userId: string
    expiresAt: string
  }
  user: {
    id: string
    email: string
    emailVerified: boolean
    name: string
    image?: string | null
  }
}

export async function getServerSession(): Promise<AuthSession | null> {
  if (process.env.NEXT_OUTPUT_EXPORT === 'true') {
    return {
      session: {
        id: 'local-session',
        userId: 'local-user',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      user: {
        id: 'local-user',
        email: 'local@momoney.internal',
        emailVerified: true,
        name: 'Local User',
      },
    }
  }

  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  if (!cookieHeader) {
    return null
  }

  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    return result?.user && result?.session ? result as AuthSession : null
  } catch {
    // If the API server is warming up or unreachable, fail gracefully without crashing SSR
    return null
  }
}

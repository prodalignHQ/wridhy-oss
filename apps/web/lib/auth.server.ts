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
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  if (!cookieHeader) {
    return null
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/get-session`, {
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
}

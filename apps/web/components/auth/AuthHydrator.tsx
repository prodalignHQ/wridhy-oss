'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'

type AuthHydratorProps = {
  user: {
    id: string
    email: string
    name: string
    emailVerified: boolean
  }
}

export function AuthHydrator({ user }: AuthHydratorProps) {
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    setUser(user)
  }, [user, setUser])

  return null
}

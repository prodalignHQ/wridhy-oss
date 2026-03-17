'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type AppAccessGuardProps = {
  emailVerified: boolean
  children: React.ReactNode
}

export function AppAccessGuard({ emailVerified, children }: AppAccessGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const onDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  const shouldRedirect = !emailVerified && !onDashboardRoute

  useEffect(() => {
    if (shouldRedirect) {
      router.replace('/dashboard?verification=required')
    }
  }, [router, shouldRedirect])

  if (shouldRedirect) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-lg font-semibold text-zinc-100">Email verification required</p>
          <p className="text-sm leading-6 text-zinc-400">
            We&apos;re taking you back to the dashboard. Verify your email there to unlock the rest of the app.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

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
  // The vault tour is the one non-dashboard route unverified users may open.
  // Vault setup is the first thing a new account should do; gating it behind
  // email verification would leave their data unencrypted until they click a
  // mail link. It reaches no user data — only the crypto ceremony.
  const openToUnverified = ['/dashboard', '/onboarding/vault']
  const allowed = openToUnverified.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const shouldRedirect = !emailVerified && !allowed

  useEffect(() => {
    if (shouldRedirect) {
      router.replace('/dashboard?verification=required')
    }
  }, [router, shouldRedirect])

  if (shouldRedirect) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-lg font-semibold text-foreground">Email verification required</p>
          <p className="text-sm leading-6 text-muted-foreground">
            We&apos;re taking you back to the dashboard. Verify your email there to unlock the rest of the app.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

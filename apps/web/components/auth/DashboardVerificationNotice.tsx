'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth.client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type DashboardVerificationNoticeProps = {
  email: string
}

export function DashboardVerificationNotice({ email }: DashboardVerificationNoticeProps) {
  const router = useRouter()
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)

  const resendVerificationEmail = async () => {
    setResending(true)

    try {
      const { error } = await authClient.sendVerificationEmail({ email })

      if (error) {
        toast.error(error.message || 'Failed to send verification email')
        return
      }

      toast.success('Verification email sent. Check your inbox.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to send verification email')
    } finally {
      setResending(false)
    }
  }

  const refreshVerificationStatus = async () => {
    setChecking(true)

    try {
      const { data, error } = await authClient.getSession()

      if (error) {
        toast.error(error.message || 'Failed to refresh session')
        return
      }

      if (!data?.user?.emailVerified) {
        toast('Your email is still awaiting verification.')
        return
      }

      toast.success('Email verified. Unlocking your workspace...')
      router.replace('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh session')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5 py-0 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]">
      <CardHeader className="border-b border-amber-500/10 py-6">
        <CardTitle className="flex items-center gap-3 text-xl text-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          Verify your email to unlock MoMoney
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6 text-foreground/80">
          You&apos;re signed in, but every feature stays locked until your email address is verified. Logout still works
          from the sidebar if you want to switch accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm leading-6 text-foreground/80">
          A verification email was sent to <span className="font-semibold text-foreground">{email}</span>. Once you verify
          it, refresh your status below and the rest of the app will unlock.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="bg-indigo-500 text-white hover:bg-indigo-600"
            disabled={checking}
            onClick={refreshVerificationStatus}
          >
            <RefreshCw className={cn(checking && 'animate-spin')} />
            {checking ? 'Checking status...' : 'Refresh verification status'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-border bg-transparent text-foreground hover:bg-muted"
            disabled={resending}
            onClick={resendVerificationEmail}
          >
            <Send />
            {resending ? 'Sending verification...' : 'Resend verification email'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

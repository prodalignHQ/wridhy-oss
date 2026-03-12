'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth.client'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type VerifyEmailCardProps = {
  email: string
}

export function VerifyEmailCard({ email }: VerifyEmailCardProps) {
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification email')
    } finally {
      setResending(false)
    }
  }

  const continueToApp = async () => {
    setChecking(true)
    try {
      const { data, error } = await authClient.getSession()

      if (error) {
        toast.error(error.message || 'Failed to refresh session')
        return
      }

      if (!data?.user?.emailVerified) {
        toast.error('Your email is still not verified')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh session')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 rounded-2xl p-4">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold mb-1">Verify your email</CardTitle>
        <CardDescription className="text-zinc-400">
          Your account is signed in, but app access stays locked until your email is verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">
          We sent a verification link to <span className="font-medium">{email}</span>.
        </div>
        <Button
          type="button"
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          disabled={checking}
          onClick={continueToApp}
        >
          {checking ? 'Checking verification...' : 'I have verified my email'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
          disabled={resending}
          onClick={resendVerificationEmail}
        >
          {resending ? 'Sending verification...' : 'Resend verification email'}
        </Button>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-3 border-t border-zinc-800 pt-6">
        <button
          type="button"
          className="text-sm text-zinc-400 hover:text-zinc-200"
          onClick={() => void logout()}
        >
          Sign out
        </button>
        <p className="text-sm text-zinc-500">
          Wrong address? <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">Create another account</Link>
        </p>
      </CardFooter>
    </Card>
  )
}

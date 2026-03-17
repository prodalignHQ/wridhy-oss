'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function SignupSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const loginHref = email ? `/login?email=${encodeURIComponent(email)}` : '/login'

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-lg bg-zinc-900 border-zinc-800 rounded-2xl p-4">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-3xl font-semibold text-zinc-50">Account created</CardTitle>
          <CardDescription className="text-zinc-400">
            Your MoMoney account is ready. We&apos;ve sent a verification email so you can unlock the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm leading-6 text-emerald-100">
            <div className="mb-2 flex items-center gap-2 font-medium text-emerald-200">
              <Mail className="h-4 w-4" />
              Verification email sent
            </div>
            <p>
              {email ? (
                <>
                  We sent a verification link to <span className="font-semibold text-zinc-50">{email}</span>.
                </>
              ) : (
                'We sent a verification link to your email address.'
              )}{' '}
              Verify your email, then sign in to unlock all features.
            </p>
          </div>
          <p className="text-sm leading-6 text-zinc-400">
            You can sign in before verifying if you want to, but MoMoney will stay locked until the email is verified.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-zinc-800 bg-transparent pt-6 sm:flex-row sm:justify-center">
          <Link
            href={loginHref}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-500 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            Go to login
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-700 px-5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Create another account
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-400">Loading...</div>}>
      <SignupSuccessContent />
    </Suspense>
  )
}

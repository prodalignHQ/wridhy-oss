'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '@/lib/auth.client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)

  const prefilledEmail = searchParams.get('email') ?? ''
  const verificationState = searchParams.get('verification')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: prefilledEmail,
    },
  })

  useEffect(() => {
    if (verificationState === 'sent') {
      toast.success('Account created. Check your email to verify before using the app.')
    }
  }, [verificationState])


  const onSubmit = async (data: LoginValues) => {
    setLoading(true)
    try {
      const { data: sessionData, error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error(error.message || 'Failed to login')
        return
      }

      if (sessionData) {
        setUser(sessionData.user)
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm bg-card border-border rounded-2xl p-4">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-semibold mb-1">Welcome back</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in to your MoMoney account</CardDescription>
        </CardHeader>
        <CardContent>
          {verificationState === 'sent' && (
            <div className="mb-4 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">
              We sent a verification link to {prefilledEmail || 'your email address'}. You can sign in now, but the app
              will stay locked until you verify your email.
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                className="bg-background border-border focus-visible:ring-primary"
                {...register('email')}
              />
              {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                className="bg-background border-border focus-visible:ring-primary"
                {...register('password')}
              />
              {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary text-white"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background p-4 text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}

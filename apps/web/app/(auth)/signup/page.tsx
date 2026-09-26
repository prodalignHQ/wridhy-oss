'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '@/lib/auth.client'
import { isLocalMode } from '@/lib/local-mode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignupValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  })

  // Standalone binary has no accounts — skip straight to the app.
  useEffect(() => {
    if (isLocalMode()) {
      router.replace('/dashboard')
    }
  }, [router])

  const onSubmit = async (data: SignupValues) => {
    setLoading(true)
    try {
      const { error } = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error(error.message || 'Failed to sign up')
        return
      }

      setUser(null)

      try {
        await authClient.signOut()
      } catch {
        // Better Auth may already leave the user signed out depending on config.
      }

      router.replace(`/signup-success?email=${encodeURIComponent(data.email)}`)
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {isLocalMode() ? (
        <p className="text-muted-foreground">Opening MoMoney...</p>
      ) : (
      <Card className="w-full max-w-sm bg-card border-border rounded-2xl p-4">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-semibold mb-1">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground">Join MoMoney to manage your finances</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                className="bg-background border-border focus-visible:ring-primary"
                {...register('name')}
              />
              {errors.name && <p className="text-rose-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="bg-background border-border focus-visible:ring-primary"
                {...register('password')}
              />
              {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                className="bg-background border-border focus-visible:ring-primary"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-rose-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary text-white"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
      )}
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth.server'

export default async function VerifyEmailPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  redirect('/dashboard')
}

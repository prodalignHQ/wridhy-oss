import { redirect } from 'next/navigation'
import { VerifyEmailCard } from '@/components/auth/VerifyEmailCard'
import { getServerSession } from '@/lib/auth.server'

export default async function VerifyEmailPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  if (session.user.emailVerified) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <VerifyEmailCard email={session.user.email} />
    </div>
  )
}

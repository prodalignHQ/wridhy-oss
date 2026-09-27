import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth.server'
import UnlockGate from './UnlockGate'

export const metadata = {
  title: 'Unlock your vault — MoMoney',
  description: 'Unlock your encrypted vault to see your money.',
}

export default async function UnlockPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white shadow-sm">
            ₹
          </span>
          <span className="text-2xl font-semibold tracking-tight">MoMoney</span>
        </div>
        <UnlockGate />
      </div>
    </div>
  )
}

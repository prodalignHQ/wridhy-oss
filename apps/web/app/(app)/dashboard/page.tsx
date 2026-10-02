import { DashboardVerificationNotice } from '@/components/auth/DashboardVerificationNotice'
import { getServerSession } from '@/lib/auth.server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const metadata = {
  title: 'Dashboard | MoMoney',
  description: 'Your personal financial overview, connected accounts, and monthly cash flow.',
}

export default async function DashboardPage() {
  const session = await getServerSession()

  return (
    <div className="space-y-6">
      {session && !session.user.emailVerified ? (
        <DashboardVerificationNotice email={session.user.email} />
      ) : (
        <DashboardClient
          userId={session?.user?.id}
          userEmail={session?.user?.email}
          userName={session?.user?.name}
        />
      )}
    </div>
  )
}

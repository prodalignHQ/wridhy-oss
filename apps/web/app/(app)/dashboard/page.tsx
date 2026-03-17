import { LayoutDashboard } from "lucide-react"
import { DashboardVerificationNotice } from '@/components/auth/DashboardVerificationNotice'
import { getServerSession } from '@/lib/auth.server'

export default async function DashboardPage() {
  const session = await getServerSession()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
      </div>
      {session && !session.user.emailVerified ? (
        <DashboardVerificationNotice email={session.user.email} />
      ) : (
        <ComingSoon
          icon={<LayoutDashboard size={40} className="text-zinc-600" />}
          title="Dashboard is coming soon"
          subtitle="Import transactions to get started. Your monthly spending overview will appear here."
        />
      )}
    </div>
  )
}

function ComingSoon({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4">{icon}</div>
      <h2 className="text-lg font-semibold text-zinc-300 mb-2">{title}</h2>
      <p className="text-sm text-zinc-500 max-w-sm">{subtitle}</p>
    </div>
  )
}

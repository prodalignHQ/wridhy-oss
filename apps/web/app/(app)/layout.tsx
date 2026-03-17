import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/layout/Sidebar"
import { AppAccessGuard } from '@/components/auth/AppAccessGuard'
import { getServerSession } from '@/lib/auth.server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={session.user} emailVerified={session.user.emailVerified} />
      {/* Main content area — offset by sidebar width */}
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-8">
          <AppAccessGuard emailVerified={session.user.emailVerified}>
            {children}
          </AppAccessGuard>
        </div>
      </main>
    </div>
  )
}

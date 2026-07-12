import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/layout/Sidebar"
import { LayoutWrapper } from "@/components/layout/LayoutWrapper"
import { AppAccessGuard } from '@/components/auth/AppAccessGuard'
import { AuthHydrator } from '@/components/auth/AuthHydrator'
import { getServerSession } from '@/lib/auth.server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AuthHydrator user={session.user} />
      <Sidebar user={session.user} emailVerified={session.user.emailVerified} />
      <LayoutWrapper>
        <AppAccessGuard emailVerified={session.user.emailVerified}>
          {children}
        </AppAccessGuard>
      </LayoutWrapper>
    </div>
  )
}

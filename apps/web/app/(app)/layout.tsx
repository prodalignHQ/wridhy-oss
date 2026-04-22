import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/layout/Sidebar"
import { LayoutWrapper } from "@/components/layout/LayoutWrapper"
import { AppAccessGuard } from '@/components/auth/AppAccessGuard'
import { getServerSession } from '@/lib/auth.server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={session?.user || null} emailVerified={session?.user?.emailVerified ?? false} />
      <LayoutWrapper>
        <AppAccessGuard emailVerified={session?.user?.emailVerified ?? true}>
          {children}
        </AppAccessGuard>
      </LayoutWrapper>
    </div>
  )
}

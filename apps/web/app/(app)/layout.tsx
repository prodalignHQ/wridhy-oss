import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/layout/Sidebar"
import { getServerSession } from '@/lib/auth.server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  if (!session.user.emailVerified) {
    redirect('/verify-email')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* Main content area — offset by sidebar width */}
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

"use client"

import { useEffect } from "react"
import { useUIStore } from "@/lib/store/ui.store"
import { cn } from "@/lib/utils"
import { initBackupTriggers } from "@/lib/engine/backup-triggers"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useUIStore()

  // Flush pending encrypted backups on tab-hide/close/reconnect.
  // Registered once for the whole authenticated area.
  useEffect(() => {
    initBackupTriggers()
  }, [])

  return (
    <main
      className={cn(
        "flex-1 min-h-screen overflow-y-auto transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "ml-16" : "ml-60"
      )}
    >
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        {children}
      </div>
    </main>
  )
}

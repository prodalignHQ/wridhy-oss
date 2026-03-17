"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  BarChart3,
  TrendingUp,
  Landmark,
  Sliders,
  Settings,
  Receipt,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth.store"
import { Button } from "@/components/ui/button"

const financeNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/statements", label: "Statements", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/networth", label: "Net Worth", icon: TrendingUp },
  { href: "/accounts", label: "Accounts", icon: Landmark },
]

const toolNavItems = [
  { href: "/rules", label: "Rules", icon: Sliders },
  { href: "/settings", label: "Settings", icon: Settings },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      )}
    >
      <Icon
        size={16}
        className={cn(active ? "text-indigo-400" : "text-zinc-500")}
      />
      {label}
    </Link>
  )
}

type SidebarProps = {
  user: {
    email: string
    name: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const logout = useAuthStore((state) => state.logout)
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || user.email[0]?.toUpperCase() || "A"

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col bg-zinc-900 border-r border-zinc-800 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">₹</span>
        </div>
        <span className="text-base font-semibold text-zinc-50 tracking-tight">
          MoMoney
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Finances */}
        <div>
          <p className="px-3 mb-1.5 text-xs font-medium uppercase tracking-widest text-zinc-600">
            Finances
          </p>
          <div className="space-y-0.5">
            {financeNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <p className="px-3 mb-1.5 text-xs font-medium uppercase tracking-widest text-zinc-600">
            Tools
          </p>
          <div className="space-y-0.5">
            {toolNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-zinc-800 px-3 py-4 space-y-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-zinc-800/40">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-zinc-300">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
          onClick={() => void logout()}
        >
          <LogOut size={16} className="text-zinc-500" />
          Logout
        </Button>
      </div>
    </aside>
  )
}

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
  Lock,
  LogOut,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth.store"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

const financeNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/statements", label: "Statements", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/networth", label: "Net Worth", icon: TrendingUp },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/settings/owners", label: "Household", icon: Users },
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
  disabled = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  disabled?: boolean
}) {
  const classes = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
    disabled
      ? "cursor-not-allowed text-muted-foreground/60"
      : active
        ? "bg-primary/12 text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
  )

  const content = (
    <>
      <Icon
        size={16}
        className={cn(
          disabled ? "text-muted-foreground/60" : active ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span>{label}</span>
      {disabled ? <Lock size={12} className="ml-auto text-muted-foreground/60" /> : null}
    </>
  )

  if (disabled) {
    return (
      <div className={classes} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  )
}

type SidebarProps = {
  user: {
    email: string
    name: string
  }
  emailVerified: boolean
}

export function Sidebar({ user, emailVerified }: SidebarProps) {
  const pathname = usePathname()
  const logout = useAuthStore((state) => state.logout)
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || user.email[0]?.toUpperCase() || "A"

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
          <span className="text-white font-bold text-sm">₹</span>
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">
          MoMoney
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Finances */}
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Finances
          </p>
          <div className="space-y-0.5">
            {financeNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                disabled={!emailVerified && item.href !== "/dashboard"}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Tools
          </p>
          <div className="space-y-0.5">
            {toolNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                disabled={!emailVerified}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="space-y-3 border-t border-sidebar-border px-3 py-4">
        {!emailVerified ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-100">
            Verify your email to unlock the rest of the app.
          </div>
        ) : null}
        <ThemeToggle />
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-2 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
            <span className="text-xs font-semibold text-secondary-foreground">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => void logout()}
        >
          <LogOut size={16} className="text-muted-foreground" />
          Logout
        </Button>
      </div>
    </aside>
  )
}

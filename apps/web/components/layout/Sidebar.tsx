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
  ChevronLeft,
  ChevronRight,
  Users as UserGroupIcon,
  LineChart,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth.store"
import { useUIStore } from "@/lib/store/ui.store"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { PrivacyToggle } from "@/components/privacy/PrivacyToggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const financeNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/statements", label: "Statements", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/networth", label: "Net Worth", icon: TrendingUp },
  { href: "/income-growth", label: "Income Growth", icon: LineChart },
  { href: "/salary-progress", label: "Salary Progress", icon: Briefcase },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/settings/owners", label: "Household", icon: UserGroupIcon },
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
  isCollapsed,
  disabled = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  isCollapsed: boolean
  disabled?: boolean
}) {
  const classes = cn(
    "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300",
    isCollapsed ? "justify-center px-2" : "gap-3",
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
          "flex-shrink-0 transition-colors",
          disabled ? "text-muted-foreground/60" : active ? "text-primary" : "text-muted-foreground"
        )}
      />
      <div
        className={cn(
          "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 opacity-0" : "w-[200px] opacity-100 flex-1"
        )}
      >
        <span className="truncate">{label}</span>
        {disabled && <Lock size={12} className="ml-auto text-muted-foreground/60" />}
      </div>
    </>
  )

  const item = disabled ? (
    <div className={classes} aria-disabled="true">
      {content}
    </div>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>{item}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return item
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
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ||
    user.email[0]?.toUpperCase() ||
    "A"

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border px-4 py-5 transition-all duration-300",
          isSidebarCollapsed ? "justify-center px-2" : "gap-2.5"
        )}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
          <span className="text-white font-bold text-sm">₹</span>
        </div>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isSidebarCollapsed ? "w-0 opacity-0" : "w-[200px] opacity-100 flex-1"
          )}
        >
          <span className="text-base font-semibold tracking-tight text-foreground truncate">
            MoMoney
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Finances */}
        <div>
          {!isSidebarCollapsed ? (
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Finances
            </p>
          ) : (
            <div className="mb-4 border-t border-sidebar-border/50 mx-2" />
          )}
          <div className="space-y-0.5">
            {financeNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isCollapsed={isSidebarCollapsed}
                disabled={!emailVerified && item.href !== "/dashboard"}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          {!isSidebarCollapsed ? (
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Tools
            </p>
          ) : (
            <div className="mb-4 border-t border-sidebar-border/50 mx-2" />
          )}
          <div className="space-y-0.5">
            {toolNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isCollapsed={isSidebarCollapsed}
                disabled={!emailVerified}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="space-y-3 border-t border-sidebar-border px-3 py-4">
        {!emailVerified && !isSidebarCollapsed ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-100">
            Verify your email to unlock the rest of the app.
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-3", isSidebarCollapsed && "items-center")}>
          <ThemeToggle isCollapsed={isSidebarCollapsed} />
          <PrivacyToggle isCollapsed={isSidebarCollapsed} />

          <div
            className={cn(
              "flex items-center rounded-lg bg-muted/60 px-2 py-2 transition-all duration-300",
              isSidebarCollapsed ? "justify-center px-1.5" : "gap-3"
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
              <span className="text-xs font-semibold text-secondary-foreground">{initials}</span>
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out min-w-0",
                isSidebarCollapsed ? "w-0 opacity-0" : "w-[200px] opacity-100 flex-1"
              )}
            >
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-300",
              isSidebarCollapsed ? "justify-center px-0" : "gap-3"
            )}
            onClick={() => void logout()}
          >
            <LogOut size={16} className="text-muted-foreground flex-shrink-0" />
            <div
              className={cn(
                "overflow-hidden text-left transition-all duration-300 ease-in-out",
                isSidebarCollapsed ? "w-0 opacity-0" : "w-[200px] opacity-100 flex-1"
              )}
            >
              <span>Logout</span>
            </div>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground hover:text-foreground shadow-sm z-50"
            onClick={toggleSidebar}
          >
            {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </Button>
        </div>
      </div>
    </aside>
  )
}

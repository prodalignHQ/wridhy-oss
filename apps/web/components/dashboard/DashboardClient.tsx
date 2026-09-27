'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Landmark,
  CreditCard,
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Users,
  Calendar,
  AlertCircle,
  ArrowRight,
  PieChart,
  Info,
  Sparkles,
  ShieldCheck,
  Building2,
  FileText,
  Clock,
  Loader2,
  Lock,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { useVaultStore } from '@/lib/store/vault.store'
import { isLocalMode } from '@/lib/local-mode'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NetWorthWidget } from '@/components/networth/NetWorthWidget'
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog'
import { MonthlyInsight } from '@momoney/types'

interface Account {
  id: string
  accountName: string
  accountType: 'bank' | 'credit_card' | 'wallet' | 'investment'
  bankId: string
  bankName: string
  currency: string
}

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

interface DashboardClientProps {
  userEmail?: string
  userName?: string
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  sky: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/20' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20' },
}

const AVATAR_BG: Record<string, string> = {
  indigo: 'bg-primary text-white',
  emerald: 'bg-emerald-500 text-white',
  rose: 'bg-rose-500 text-white',
  amber: 'bg-amber-500 text-white',
  sky: 'bg-sky-500 text-white',
  violet: 'bg-violet-500 text-white',
}

export function DashboardClient({ userEmail, userName }: DashboardClientProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [accounts, setAccounts] = useState<Account[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [insights, setInsights] = useState<MonthlyInsight | null>(null)
  const [showVaultBanner, setShowVaultBanner] = useState(false)
  const [showLockedBanner, setShowLockedBanner] = useState(false)
  const vaultStatus = useVaultStore((s) => s.status)
  
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)

  // Fetch accounts and owners
  const loadInitialData = useCallback(async () => {
    try {
      const [accList, ownerList] = await Promise.all([
        apiClient.fetch<Account[]>('/v1/accounts').catch(() => []),
        apiClient.fetch<Owner[]>('/v1/owners').catch(() => []),
      ])
      setAccounts(accList)
      setOwners(ownerList)
    } catch (err) {
      console.error('Failed to load dashboard data', err)
      toast.error('Failed to load some dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch monthly spending insights — on-device first (OPFS cache), server fallback
  const loadInsights = useCallback(async (month: string) => {
    setInsightsLoading(true)
    try {
      const { localAnalytics } = await import('@/lib/engine/analytics-client')
      const data = await localAnalytics.monthly(month).catch(() => null)
      if (data) {
        setInsights(data)
        return
      }
      const fallback = await apiClient.fetch<MonthlyInsight>(`/v1/insights/monthly?month=${month}`).catch(() => null)
      setInsights(fallback)
    } catch (err) {
      console.error('Failed to load insights', err)
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Vault onboarding: no vault + not skipped → guided setup; skipped → banner.
  // Vault exists but locked → unlock gate once per session (with a vault,
  // nearly all data is sealed — wandering the app locked is misleading).
  // Login and vault-unlock stay separate by design: two keys, two jobs.
  // Vault onboarding/gating is skipped entirely in standalone-binary local
  // mode: zero-setup means zero nags — the vault stays available in
  // Settings for users who explicitly want at-rest sealing, but nothing
  // pushes them there and nothing redirects.
  useEffect(() => {
    if (loading || isLocalMode()) return
    let cancelled = false
    import('@/lib/engine/vault-sync').then(async ({ fetchVaultBlob }) => {
      const blob = await fetchVaultBlob().catch(() => 'error' as const)
      if (cancelled) return
      if (blob === null) {
        let skipped = false
        try {
          skipped = sessionStorage.getItem('momoney_vault_onboarding_skip') === '1'
        } catch {
          // ignore
        }
        if (!skipped) {
          router.replace('/onboarding/vault')
        } else {
          setShowVaultBanner(true)
        }
      } else {
        if (useVaultStore.getState().status !== 'unlocked') {
          let prompted = false
          try {
            prompted = sessionStorage.getItem('momoney_vault_unlock_prompted') === '1'
          } catch {
            // ignore
          }
          if (!prompted) {
            try {
              sessionStorage.setItem('momoney_vault_unlock_prompted', '1')
            } catch {
              // ignore
            }
            router.replace('/unlock')
          } else {
            setShowLockedBanner(true)
          }
        }
      }
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loading, router])

  // Vault unlocked elsewhere (e.g. settings tab) → drop the locked banner.
  useEffect(() => {
    if (vaultStatus === 'unlocked') setShowLockedBanner(false)
  }, [vaultStatus])

  useEffect(() => {
    loadInsights(currentMonth)
  }, [currentMonth, loadInsights])

  // Another device synced: reload insights from the restored cache.
  useEffect(() => {
    const onVaultUpdate = () => {
      loadInsights(currentMonth)
    }
    window.addEventListener('momoney:vault-updated', onVaultUpdate)
    return () => {
      window.removeEventListener('momoney:vault-updated', onVaultUpdate)
    }
  }, [currentMonth, loadInsights])

  const defaultOwner = owners.find((o) => o.isDefault) || owners[0]
  const familyMembers = owners.filter((o) => !o.isDefault)

  const bankAccounts = accounts.filter((a) => a.accountType === 'bank')
  const creditCards = accounts.filter((a) => a.accountType === 'credit_card')
  const otherAccounts = accounts.filter((a) => a.accountType !== 'bank' && a.accountType !== 'credit_card')

  const totalSpend = insights ? parseFloat(insights.totalSpend) : 0
  const totalIncome = insights ? parseFloat(insights.totalIncome) : 0
  const netFlow = insights ? parseFloat(insights.netFlow) : 0

  const handleAccountCreated = () => {
    loadInitialData()
  }

  const formatAccountType = (type: string) => {
    switch (type) {
      case 'bank': return 'Savings / Checking'
      case 'credit_card': return 'Credit Card'
      case 'wallet': return 'Wallet'
      case 'investment': return 'Investment'
      default: return type
    }
  }

  const displayName = defaultOwner?.name || userName || (userEmail ? userEmail.split('@')[0] : 'there')

  return (
    <div className="space-y-8 pb-12">
      {showLockedBanner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-sky-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your vault is locked</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logging in proves who you are — unlocking is separate and needs your passkey, password, or recovery code.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/unlock">
              <Button size="sm" className="bg-primary text-white">Unlock vault</Button>
            </Link>
          </div>
        </div>
      )}
      {showVaultBanner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your data isn&apos;t end-to-end encrypted yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Secure your vault in 60 seconds — passkey or password, plus a recovery code.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/onboarding/vault">
              <Button size="sm" className="bg-primary text-white">Secure my vault</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setShowVaultBanner(false)} className="text-muted-foreground">
              Later
            </Button>
          </div>
        </div>
      )}
      {/* ─── Header & Period Selector ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {displayName}
            </h1>
            <span className="text-xl">👋</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Here is your financial pulse, connected accounts, and monthly cash flow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month selector for spending statistics */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm text-xs">
            <Calendar size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground font-medium hidden sm:inline">Spend Period:</span>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => e.target.value && setCurrentMonth(e.target.value)}
              className="bg-transparent text-foreground font-medium outline-none cursor-pointer text-xs"
            />
          </div>

          <Button
            onClick={() => setIsAddAccountOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white shadow-sm font-medium gap-1.5"
          >
            <Plus size={15} />
            Add Account
          </Button>
        </div>
      </div>

      {/* ─── Top Financial Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Isolated Personal Net Worth */}
        <NetWorthWidget
          ownerId={defaultOwner?.id}
          ownerName={defaultOwner?.name || 'You'}
        />

        {/* 2. Monthly Spend Card */}
        <Link href="/insights" className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl h-full">
          <Card className="bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer group h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/90 transition-colors">
                    Monthly Spend
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <TrendingDown size={14} />
                  </div>
                </div>

                <div className="flex flex-col">
                  {insightsLoading ? (
                    <div className="h-8 w-28 bg-muted rounded animate-pulse" />
                  ) : (
                    <span className="text-3xl font-bold tracking-tight font-mono text-foreground">
                      {formatINR(totalSpend)}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Clock size={12} className="shrink-0 text-muted-foreground/70" />
                    <span>Monthly living expenses</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{format(new Date(`${currentMonth}-01`), 'MMM yyyy')} Outflows</span>
                <span className="text-primary group-hover:underline">View Insights &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 3. Monthly Income & Net Flow */}
        <Link href="/insights" className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl h-full">
          <Card className="bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer group h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/90 transition-colors">
                    Monthly Income
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <TrendingUp size={14} />
                  </div>
                </div>

                <div className="flex flex-col">
                  {insightsLoading ? (
                    <div className="h-8 w-28 bg-muted rounded animate-pulse" />
                  ) : (
                    <span className="text-3xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
                      {formatINR(totalIncome)}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <span>Net Flow:</span>
                    <span className={cn('font-mono font-medium', netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                      {netFlow >= 0 ? '+' : ''}{formatINR(netFlow)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Cash Surplus / Deficit</span>
                <span className="text-primary group-hover:underline">Deep Dive &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 4. Connected Accounts Overview */}
        <Link href="/accounts" className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl h-full">
          <Card className="bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer group h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/90 transition-colors">
                    Connected Accounts
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                    <Building2 size={14} />
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-3xl font-bold tracking-tight font-mono text-foreground">
                    {accounts.length}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {bankAccounts.length} Bank{bankAccounts.length === 1 ? '' : 's'} · {creditCards.length} Card{creditCards.length === 1 ? '' : 's'}
                    {otherAccounts.length > 0 && ` · ${otherAccounts.length} Other`}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Bank &amp; Credit Accounts</span>
                <span className="text-primary group-hover:underline">Manage &rarr;</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── Crucial Accounts Section ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Landmark size={20} className="text-primary" />
              Financial Accounts
              <Badge variant="secondary" className="text-xs font-mono">
                {accounts.length}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accounts are the foundation of MoMoney. Link accounts to import statements and auto-categorize transactions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddAccountOpen(true)}
              className="text-xs font-medium gap-1.5"
            >
              <Plus size={14} />
              Add Account
            </Button>
            <Link href="/accounts">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                View All &rarr;
              </Button>
            </Link>
          </div>
        </div>

        {accounts.length === 0 ? (
          /* Empty state for accounts - highly encouraging call to action */
          <Card className="bg-card/70 border border-dashed border-border rounded-2xl p-8 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
                <Landmark size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  A bank account is crucial to get started
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  MoMoney parses bank and credit card statements locally or securely to automate your finances. Add your first bank account or credit card to unlock statements and transaction insights.
                </p>
              </div>
              <Button
                onClick={() => setIsAddAccountOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white gap-2 font-medium"
              >
                <Plus size={16} />
                Connect Your First Account
              </Button>
            </div>
          </Card>
        ) : (
          /* Grid of connected accounts */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isCard = acc.accountType === 'credit_card'
              return (
                <Card
                  key={acc.id}
                  className="bg-card border-border hover:border-border/80 transition-all rounded-xl p-5 relative group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-sm',
                            isCard
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          )}
                        >
                          {isCard ? <CreditCard size={18} /> : acc.bankName.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground text-sm truncate" title={acc.accountName}>
                            {acc.accountName}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">{acc.bankName}</p>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium uppercase tracking-wider shrink-0 bg-muted text-muted-foreground"
                      >
                        {formatAccountType(acc.accountType)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground text-[11px]">{acc.currency}</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/statements?accountId=${acc.id}`}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <FileText size={12} />
                        Import Statement
                      </Link>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Monthly Spending Breakdown & Credit Card Validation ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Top Spending Categories */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border h-full flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <PieChart size={18} className="text-primary" />
                    Top Spending Categories ({format(new Date(`${currentMonth}-01`), 'MMMM yyyy')})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Aggregated expenses for the selected billing month
                  </CardDescription>
                </div>
                <Link href="/insights">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                    Insights Dashboard &rarr;
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 flex-1">
              {insightsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="animate-spin h-6 w-6 mb-2" />
                  <span className="text-xs">Loading spending categories...</span>
                </div>
              ) : !insights || insights.topCategories.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border/70 rounded-xl">
                  <PieChart size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-foreground/80">No spending recorded for this month</p>
                  <p className="text-muted-foreground/70 mt-1 max-w-xs mx-auto">
                    Import statements or add transactions tagged with {format(new Date(`${currentMonth}-01`), 'MMMM yyyy')} to see category breakdown.
                  </p>
                  <Link href="/statements" className="inline-block mt-3">
                    <Button variant="outline" size="sm" className="text-xs">
                      Import Statement
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {insights.topCategories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#3b82f6' }}
                          />
                          <span>{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-foreground font-semibold">{formatINR(cat.amount)}</span>
                          <span className="text-muted-foreground text-[11px]">({cat.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                            backgroundColor: cat.color || '#3b82f6',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {insights && insights.uncategorizedCount > 0 && (
              <div className="px-6 py-3 bg-amber-500/5 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-amber-500" />
                  <span>
                    You have <strong>{insights.uncategorizedCount}</strong> uncategorized transaction
                    {insights.uncategorizedCount > 1 ? 's' : ''} this month.
                  </span>
                </div>
                <Link href="/transactions" className="font-semibold underline hover:opacity-80">
                  Categorize &rarr;
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Credit Card Spend Validation & Household Overview */}
        <div className="space-y-6">
          {/* Credit Card Spend Attribution Explanation Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                Spending &amp; Billing Attribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                In MoMoney, expenses are attributed to their <strong className="text-foreground">actual transaction dates</strong> so multi-month statements and daily transactions reflect real monthly living costs accurately.
              </p>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                  <Info size={12} className="text-primary shrink-0" />
                  Zero Double-Counting
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Card spends are counted as living expenses, while credit card bill repayments from your bank accounts are classified as internal transfers to prevent double-counting.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Household & Family Members Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Household Members
                </CardTitle>
                <Link
                  href="/settings/owners"
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Manage &rarr;
                </Link>
              </div>
              <CardDescription className="text-xs">
                Split transactions and track individual net worth
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Primary User (Logged-in) */}
              {defaultOwner && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm',
                        AVATAR_BG[defaultOwner.color] || 'bg-primary text-white'
                      )}
                    >
                      {defaultOwner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground">{defaultOwner.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/25">
                          You (Self)
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Primary Account Holder</p>
                    </div>
                  </div>
                  <Link href="/networth" className="text-[11px] text-primary hover:underline">
                    Net Worth &rarr;
                  </Link>
                </div>
              )}

              {/* Family Members */}
              {familyMembers.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                    Family Members ({familyMembers.length})
                  </span>
                  {familyMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm',
                            AVATAR_BG[member.color] || 'bg-muted text-foreground'
                          )}
                        >
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-foreground text-xs">{member.name}</span>
                          {member.notes && (
                            <p className="text-[10px] text-muted-foreground">{member.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center border border-dashed border-border/70 rounded-lg">
                  <p className="text-[11px] text-muted-foreground">No additional family members added yet.</p>
                  <Link href="/settings/owners" className="text-[11px] text-primary hover:underline font-medium block mt-1">
                    + Add Family Member
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Add Account Modal ────────────────────────────────────────────── */}
      <AddAccountDialog
        open={isAddAccountOpen}
        onOpenChange={setIsAddAccountOpen}
        onSuccess={handleAccountCreated}
      />
    </div>
  )
}

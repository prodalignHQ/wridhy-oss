'use client'

import { useEffect, useState } from 'react'
import { Calendar, Users, TrendingDown, TrendingUp, Wallet, ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStorageMode } from '@/lib/store/storage-mode'
import { apiClient } from '@/lib/api'
import { Owner } from '@/lib/store/transactions.store'
import { YearOverviewChart } from '@/components/insights/YearOverviewChart'
import { CategoryComparisonTable } from '@/components/insights/CategoryComparisonTable'
import { CategoryAveragesTable } from '@/components/insights/CategoryAveragesTable'
import { MonthlyInsight, YearlyInsight, CategoryComparison, CategoryAverage } from '@momoney/types'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(String(value)))

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

// ─── Insights Page ────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { adapter } = useStorageMode()
  
  // Filters
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [year, setYear] = useState(new Date().getFullYear())
  
  // Data
  const [owners, setOwners] = useState<Owner[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyInsight | null>(null)
  const [yearlyData, setYearlyData] = useState<YearlyInsight | null>(null)
  const [categoryComparison, setCategoryComparison] = useState<CategoryComparison | null>(null)
  const [categoryAverages, setCategoryAverages] = useState<CategoryAverage | null>(null)
  
  // Loading/Error states
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    apiClient.fetch<Owner[]>('/v1/owners').then(setOwners).catch(console.error)
  }, [])

  // Fetch all insights when filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [monthly, yearly, comparison, averages] = await Promise.all([
          adapter.getMonthlyInsights(month, selectedOwners),
          adapter.getYearlyInsights(year, selectedOwners),
          adapter.getCategoryComparison(month, selectedOwners),
          adapter.getCategoryAverages(month, selectedOwners),
        ])

        setMonthlyData(monthly)
        setYearlyData(yearly)
        setCategoryComparison(comparison)
        setCategoryAverages(averages)
      } catch (err: any) {
        setError(err.message || 'Failed to load insights')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [adapter, month, year, selectedOwners])

  const toggleOwner = (ownerId: string) => {
    setSelectedOwners(prev => 
      prev.includes(ownerId) ? prev.filter(id => id !== ownerId) : [...prev, ownerId]
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
          <AlertCircle size={26} className="text-rose-500" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">Failed to load insights</p>
        <p className="text-xs text-muted-foreground/70 mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header & Filters ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Insights Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your spending patterns and category performance</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-lg border border-border focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <Calendar size={14} className="text-muted-foreground ml-1" />
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value)
                setYear(parseInt(e.target.value.split('-')[0]))
              }}
              className="h-8 w-36 bg-transparent border-none focus-visible:ring-0 text-xs text-foreground/90 py-0"
            />
          </div>

          <div className="h-8 w-px bg-border hidden sm:block mx-1" />

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {owners.map((owner) => (
              <button
                key={owner.id}
                onClick={() => toggleOwner(owner.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap',
                  selectedOwners.includes(owner.id)
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                    : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground/90 hover:border-muted-foreground/30'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', COLOR_MAP[owner.color] || 'bg-zinc-500')} />
                {owner.name}
              </button>
            ))}
            {selectedOwners.length > 0 && (
              <button 
                onClick={() => setSelectedOwners([])}
                className="text-[10px] text-muted-foreground hover:text-indigo-400 underline px-1 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading && !monthlyData ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <div className="relative">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Analyzing your finances…</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
          
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                  <TrendingUp size={14} className="text-emerald-500" /> Total Income
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-400 pt-1">
                  {formatINR(monthlyData?.totalIncome || '0')}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                  <TrendingDown size={14} className="text-rose-500" /> Living Spending
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-rose-400 pt-1">
                  {formatINR(monthlyData?.totalSpend || '0')}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                  <TrendingUp size={14} className="text-emerald-400" /> Savings & Investments
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-400 pt-1">
                  {formatINR(monthlyData?.totalInvestments || '0')}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                  <Wallet size={14} className="text-indigo-500" /> Net Flow
                </CardDescription>
                <CardTitle className={cn(
                  "text-2xl font-bold tabular-nums pt-1",
                  parseFloat(monthlyData?.netFlow || '0') >= 0 ? "text-indigo-400" : "text-rose-400"
                )}>
                  {formatINR(monthlyData?.netFlow || '0')}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Year Overview */}
            <Card className="lg:col-span-12 bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20 px-6 py-4">
                <div>
                  <CardTitle className="text-base font-semibold">Monthly Trends ({year})</CardTitle>
                  <CardDescription className="text-xs">Income vs Spending cash flow</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {yearlyData && <YearOverviewChart data={yearlyData} />}
              </CardContent>
            </Card>

            {/* Category Comparison Table */}
            <Card className="lg:col-span-7 bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
                <CardDescription className="text-xs">Comparison with previous month</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {categoryComparison && <CategoryComparisonTable data={categoryComparison} />}
              </CardContent>
            </Card>

            {/* Category Averages Table */}
            <Card className="lg:col-span-5 bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                <CardTitle className="text-base font-semibold">Average Spending (12 mo.)</CardTitle>
                <CardDescription className="text-xs">Current month vs 12-month average</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {categoryAverages && <CategoryAveragesTable data={categoryAverages} />}
              </CardContent>
            </Card>
          </div>

          {/* ── Footer Info ── */}
          {monthlyData && monthlyData.uncategorizedCount > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 shadow-sm">
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <AlertCircle size={18} className="text-amber-500" />
              </div>
              <p className="text-sm text-amber-500/90 leading-tight">
                You have <span className="font-bold underline cursor-pointer decoration-amber-500/50 hover:decoration-amber-500">{monthlyData.uncategorizedCount} uncategorized transactions</span> this month. 
                <span className="opacity-70 ml-1">Assign categories to improve the accuracy of these insights.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

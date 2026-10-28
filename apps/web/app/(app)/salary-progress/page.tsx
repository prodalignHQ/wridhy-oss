'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Calendar,
  Building2,
  Users,
  Coins,
  Receipt,
  Award,
  Layers,
  Sparkles,
  ArrowRight,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  LineChart as LineChartIcon,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StatCard } from '@/components/ui/custom/StatCard'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { AddSalarySourceModal } from '@/components/salary/AddSalarySourceModal'
import { AddSalaryRevisionModal } from '@/components/salary/AddSalaryRevisionModal'
import { SalaryTimelineChart, type SalaryTimelineEvent } from '@/components/salary/SalaryTimelineChart'
import { SalaryProrationCalculator } from '@/components/salary/SalaryProrationCalculator'
import { PrivacyFlip } from '@/components/privacy/PrivacyFlip'

interface Owner {
  id: string
  name: string
  color: string
}

interface SalaryRevision {
  id: string
  salarySourceId: string
  effectiveDate: string
  annualCtc: string
  annualCtcNumber: number
  baseSalaryNumber: number
  monthlyInHandNumber: number
  variablePayNumber: number
  stockGrantNumber: number
  calculatedHikePercentage: number | null
  hikeAmount: number
  hikeType: string
  designation?: string | null
  notes?: string | null
  monthsSinceLastRevision: number | null
  hikeCagr?: number | null
  hikeXirr?: number | null
  cumulativeCagr?: number | null
  cumulativeXirr?: number | null
}

interface SalarySource {
  id: string
  ownerId?: string | null
  companyName: string
  role: string
  employmentType: string
  currency: string
  startDate: string
  endDate?: string | null
  status: 'active' | 'past'
  notes?: string | null
  revisions: SalaryRevision[]
  currentRevision: SalaryRevision | null
  currentAnnualCtc: number
  currentMonthlyInHand: number
  currentBaseSalary: number
  currentVariablePay: number
  currentStockGrant: number
  totalHikesCount: number
  owner?: Owner | null
}

interface SalaryResponse {
  sources: SalarySource[]
  summary: {
    totalActiveSources: number
    totalActiveAnnualCtc: number
    totalActiveMonthlyInHand: number
    totalActiveBaseSalary: number
    totalActiveVariablePay: number
    totalActiveStockGrant: number
    totalHikesCount: number
    latestHike: {
      effectiveDate: string
      hikePercentage: number | null
      hikeAmount: number
      hikeCagr?: number | null
      hikeXirr?: number | null
      cumulativeCagr?: number | null
      cumulativeXirr?: number | null
      companyName: string
      hikeType: string
      designation?: string
    } | null
    careerSalaryMultiplier: number | null
    careerCagr?: number | null
    careerXirr?: number | null
    finalHikeCagr?: number | null
    finalHikeXirr?: number | null
  }
}

export default function SalaryProgressPage() {
  const [data, setData] = useState<SalaryResponse | null>(null)
  const [timeline, setTimeline] = useState<SalaryTimelineEvent[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'sources' | 'timeline' | 'calculator'>('sources')
  const [isLoading, setIsLoading] = useState(true)

  // Expandable sources map
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})

  // Modals state
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [sourceToEdit, setSourceToEdit] = useState<SalarySource | null>(null)
  const [sourceToDelete, setSourceToDelete] = useState<SalarySource | null>(null)
  const [isDeletingSource, setIsDeletingSource] = useState(false)

  const [isAddRevisionOpen, setIsAddRevisionOpen] = useState(false)
  const [revisionSourceId, setRevisionSourceId] = useState<string | null>(null)
  const [revisionToEdit, setRevisionToEdit] = useState<SalaryRevision | null>(null)
  const [revisionToDelete, setRevisionToDelete] = useState<SalaryRevision | null>(null)
  const [isDeletingRevision, setIsDeletingRevision] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)

  const handleRecalculateDateWise = async () => {
    setIsRecalculating(true)
    try {
      const res = await apiClient.fetch<{
        message: string
        sourcesProcessed: number
        totalUpdated: number
      }>('/v1/salary/recalculate', {
        method: 'POST',
      })
      toast.success(res?.message || 'Date-wise recalculation complete!')
      await fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to recalculate revisions')
    } finally {
      setIsRecalculating(false)
    }
  }

  // Fetch owners
  useEffect(() => {
    apiClient
      .fetch<Owner[]>('/v1/owners')
      .then(setOwners)
      .catch((err) => console.error('Failed to load owners:', err))
  }, [])

  // Fetch salary sources and timeline
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const query = selectedOwnerId !== 'all' ? `?ownerId=${selectedOwnerId}` : ''
      const [sourcesRes, timelineRes] = await Promise.all([
        apiClient.fetch<SalaryResponse>(`/v1/salary/sources${query}`),
        apiClient.fetch<SalaryTimelineEvent[]>(`/v1/salary/timeline${query}`),
      ])
      setData(sourcesRes)
      setTimeline(timelineRes)

      // Auto-expand sources by default
      const initialExpanded: Record<string, boolean> = {}
      sourcesRes.sources.forEach((s) => {
        initialExpanded[s.id] = true
      })
      setExpandedSources(initialExpanded)
    } catch (err: any) {
      console.error('Failed to load salary progress:', err)
      toast.error(err.message || 'Failed to load salary progress')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedOwnerId])

  const handleDeleteSource = async () => {
    if (!sourceToDelete) return
    setIsDeletingSource(true)
    try {
      await apiClient.fetch(`/v1/salary/sources/${sourceToDelete.id}`, {
        method: 'DELETE',
      })
      toast.success(`Removed salary source ${sourceToDelete.companyName}`)
      setSourceToDelete(null)
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to delete salary source')
    } finally {
      setIsDeletingSource(false)
    }
  }

  const handleDeleteRevision = async () => {
    if (!revisionToDelete) return
    setIsDeletingRevision(true)
    try {
      await apiClient.fetch(`/v1/salary/revisions/${revisionToDelete.id}`, {
        method: 'DELETE',
      })
      toast.success('Removed salary revision')
      setRevisionToDelete(null)
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to delete revision')
    } finally {
      setIsDeletingRevision(false)
    }
  }

  const toggleSourceExpand = (sourceId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }))
  }

  const summary = data?.summary
  const sources = data?.sources || []

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Salary Progress</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Multiple Sources & Hikes
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track compensation from multiple employers, record mid-year hikes, and monitor your career growth trajectory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PrivacyFlip />
          <Link href="/income-growth">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <LineChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Income Growth
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs"
            onClick={handleRecalculateDateWise}
            disabled={isRecalculating || sources.length === 0}
            title="Recalculate all hike percentages chronologically based on revision dates"
          >
            <RotateCcw className={cn("h-3.5 w-3.5 text-primary", isRecalculating && "animate-spin")} />
            Recalculate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs"
            onClick={() => {
              setRevisionSourceId(null)
              setRevisionToEdit(null)
              setIsAddRevisionOpen(true)
            }}
            disabled={sources.length === 0}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Record Hike
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs shadow-xs"
            onClick={() => {
              setSourceToEdit(null)
              setIsAddSourceOpen(true)
            }}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Salary Source
          </Button>
        </div>
      </div>

      {/* Owner Filter */}
      {owners.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mr-1">
            <Users className="h-3.5 w-3.5" />
            Household:
          </span>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 px-3 text-xs rounded-full border',
              selectedOwnerId === 'all'
                ? 'bg-foreground text-background border-foreground font-medium'
                : 'text-muted-foreground border-border hover:text-foreground'
            )}
            onClick={() => setSelectedOwnerId('all')}
          >
            All Members
          </Button>
          {owners.map((owner) => (
            <Button
              key={owner.id}
              size="sm"
              variant="ghost"
              className={cn(
                'h-7 px-3 text-xs rounded-full border transition-all',
                selectedOwnerId === owner.id
                  ? 'bg-primary text-primary-foreground border-primary font-medium shadow-xs'
                  : 'text-muted-foreground border-border hover:text-foreground'
              )}
              onClick={() => setSelectedOwnerId(owner.id)}
            >
              {owner.name}
            </Button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        /* Empty State */
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Briefcase className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Salary Sources Added Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add your current or past employers to start tracking salary increments, mid-year appraisal bumps, and career earnings progress.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSourceToEdit(null)
              setIsAddSourceOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add First Salary Source
          </Button>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Annual CTC"
              value={formatINR(summary?.totalActiveAnnualCtc ?? 0)}
              subLabel={`Across ${summary?.totalActiveSources || 0} active job${
                (summary?.totalActiveSources || 0) === 1 ? '' : 's'
              }`}
              valueColor="green"
              icon={<Coins className="h-4 w-4" />}
            />

            <StatCard
              label="Monthly In-Hand"
              value={formatINR(summary?.totalActiveMonthlyInHand ?? 0)}
              subLabel={`Base: ${formatINR(summary?.totalActiveBaseSalary ?? 0)}/yr`}
              icon={<Receipt className="h-4 w-4" />}
            />

            <StatCard
              label="Latest Hike"
              value={
                summary?.latestHike?.hikePercentage !== null && summary?.latestHike?.hikePercentage !== undefined
                  ? `+${summary.latestHike.hikePercentage.toFixed(1)}%`
                  : 'Baseline'
              }
              subLabel={
                summary?.latestHike
                  ? `${summary.latestHike.companyName} • ${
                      (summary.latestHike.hikeCagr ?? summary.latestHike.hikeXirr) !== null &&
                      (summary.latestHike.hikeCagr ?? summary.latestHike.hikeXirr) !== undefined
                        ? `${(summary.latestHike.hikeCagr ?? summary.latestHike.hikeXirr)! >= 0 ? '+' : ''}${(summary.latestHike.hikeCagr ?? summary.latestHike.hikeXirr)!.toFixed(1)}% CAGR`
                        : summary.latestHike.effectiveDate.split('T')[0]
                    }`
                  : 'No hikes recorded yet'
              }
              trend={summary?.latestHike ? 'up' : 'neutral'}
              trendValue={
                summary?.latestHike ? `+${formatINR(summary.latestHike.hikeAmount)}` : undefined
              }
              valueColor="green"
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            />

            <StatCard
              label="Career Growth & CAGR"
              value={
                (summary?.careerCagr ?? summary?.careerXirr) !== null &&
                (summary?.careerCagr ?? summary?.careerXirr) !== undefined
                  ? `${(summary?.careerCagr ?? summary?.careerXirr)! >= 0 ? '+' : ''}${(summary?.careerCagr ?? summary?.careerXirr)!.toFixed(1)}% CAGR`
                  : summary?.careerSalaryMultiplier
                  ? `${summary.careerSalaryMultiplier.toFixed(1)}x`
                  : '1.0x'
              }
              subLabel={
                summary?.careerSalaryMultiplier
                  ? `${summary.careerSalaryMultiplier.toFixed(1)}x multiplier (${summary?.totalHikesCount || 0} hike${
                      (summary?.totalHikesCount || 0) === 1 ? '' : 's'
                    })`
                  : `${summary?.totalHikesCount || 0} hike revisions`
              }
              trend={(summary?.careerCagr ?? summary?.careerXirr) && (summary?.careerCagr ?? summary?.careerXirr)! > 0 ? 'up' : 'neutral'}
              trendValue={
                summary?.careerSalaryMultiplier ? `${summary.careerSalaryMultiplier.toFixed(1)}x` : undefined
              }
              valueColor="green"
              icon={<Award className="h-4 w-4 text-primary" />}
            />
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-border pb-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 text-xs rounded-lg transition-all',
                activeTab === 'sources'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('sources')}
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Salary Sources ({sources.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 text-xs rounded-lg transition-all',
                activeTab === 'timeline'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('timeline')}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Career Timeline & Chart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 text-xs rounded-lg transition-all',
                activeTab === 'calculator'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('calculator')}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Mid-Year Proration Calculator
            </Button>
          </div>

          {/* Tab 1: Salary Sources & Revisions */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              {sources.map((source) => {
                const isExpanded = !!expandedSources[source.id]
                const sortedRevisions = [...source.revisions].reverse()

                return (
                  <div
                    key={source.id}
                    className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all"
                  >
                    {/* Source Header Card */}
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {source.companyName}
                          </h3>

                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                              source.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border border-border'
                            )}
                          >
                            {source.status === 'active' ? 'Active Job' : 'Former Employer'}
                          </span>

                          <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full font-medium capitalize">
                            {source.employmentType.replace('_', ' ')}
                          </span>

                          {source.owner && (
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                              style={{
                                borderColor: `${source.owner.color}40`,
                                backgroundColor: `${source.owner.color}15`,
                                color: source.owner.color,
                              }}
                            >
                              {source.owner.name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{source.role}</span>
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="h-3 w-3" />
                            {source.startDate.split('T')[0]} to{' '}
                            {source.endDate ? source.endDate.split('T')[0] : 'Present'}
                          </span>
                          {source.notes && (
                            <span className="text-muted-foreground/80 italic">“{source.notes}”</span>
                          )}
                        </div>
                      </div>

                      {/* Current Compensation Pill & Actions */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-right">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Current Annual CTC
                          </p>
                          <p className="text-xl font-bold font-mono text-primary">
                            {formatINR(source.currentAnnualCtc)}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {formatINR(source.currentMonthlyInHand)}/mo in-hand
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => {
                              setRevisionSourceId(source.id)
                              setRevisionToEdit(null)
                              setIsAddRevisionOpen(true)
                            }}
                          >
                            <TrendingUp className="h-3 w-3" />
                            Record Hike
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSourceToEdit(source)
                              setIsAddSourceOpen(true)
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setSourceToDelete(source)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => toggleSourceExpand(source.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Revisions History (Mid-Year & Annual Hikes) */}
                    {isExpanded && (
                      <div className="border-t border-border/70 bg-muted/15 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            Compensation Revision History ({source.revisions.length})
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Mid-year hikes take effect from their specific start date
                          </span>
                        </div>

                        {source.revisions.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                            No revisions recorded. Click "Record Hike" to log an appraisal or mid-year increment.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sortedRevisions.map((rev) => {
                              const isPositive =
                                rev.calculatedHikePercentage !== null &&
                                rev.calculatedHikePercentage > 0

                              return (
                                <div
                                  key={rev.id}
                                  className="p-3 rounded-xl bg-card border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-foreground font-mono">
                                        Effective: {rev.effectiveDate.split('T')[0]}
                                      </span>

                                      <span className="capitalize text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                        {rev.hikeType.replace('_', ' ')}
                                      </span>

                                      {rev.designation && (
                                        <span className="text-muted-foreground text-xs">
                                          → {rev.designation}
                                        </span>
                                      )}
                                    </div>

                                    {rev.notes && (
                                      <p className="text-[11px] text-muted-foreground italic">
                                        “{rev.notes}”
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <span className="font-mono font-bold text-sm text-foreground">
                                        {formatINR(rev.annualCtcNumber)}
                                      </span>
                                      <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-end gap-1.5">
                                        <span>In-hand: {formatINR(rev.monthlyInHandNumber)}/mo</span>
                                        {rev.variablePayNumber > 0 && (
                                          <span>• Bonus: {formatINR(rev.variablePayNumber)}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="min-w-[110px] text-right space-y-0.5">
                                      {rev.calculatedHikePercentage !== null ? (
                                        <div className="flex flex-col items-end">
                                          <span
                                            className={cn(
                                              'inline-flex items-center gap-0.5 font-bold font-mono text-xs px-2 py-0.5 rounded-md',
                                              isPositive
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-muted text-muted-foreground'
                                            )}
                                          >
                                            {isPositive && '+'}
                                            {rev.calculatedHikePercentage.toFixed(1)}%
                                          </span>
                                          {(rev.hikeCagr ?? rev.hikeXirr) !== null && (rev.hikeCagr ?? rev.hikeXirr) !== undefined && (
                                            <span
                                              className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400"
                                              title="Annualized hike return (CAGR) for this revision"
                                            >
                                              {(rev.hikeCagr ?? rev.hikeXirr)! >= 0 ? '+' : ''}{(rev.hikeCagr ?? rev.hikeXirr)!.toFixed(1)}% CAGR
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                          Joining
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                          setRevisionToEdit(rev)
                                          setSelectedOwnerId(selectedOwnerId)
                                          setIsAddRevisionOpen(true)
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => setRevisionToDelete(rev)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab 2: Career Timeline & Chart */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <SalaryTimelineChart timeline={timeline} />

              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  Career Milestones & Revision Log
                </h3>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {[...timeline].reverse().map((event, idx) => {
                    const isFinalHike = idx === 0 && timeline.length > 1
                    return (
                      <div key={event.revisionId} className="relative flex items-start gap-4">
                        <div
                          className={cn(
                            'absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 bg-background',
                            isFinalHike
                              ? 'border-amber-500 ring-2 ring-amber-500/30'
                              : 'border-primary'
                          )}
                        />

                        <div
                          className={cn(
                            'flex-1 p-3.5 rounded-xl border space-y-2 transition-all',
                            isFinalHike
                              ? 'bg-amber-500/5 border-amber-500/30 dark:bg-amber-500/10'
                              : 'bg-muted/25 border-border/70'
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {event.companyName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                • {event.designation || event.role}
                              </span>
                              {isFinalHike && (
                                <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                  Final Hike
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">
                              {event.effectiveDate}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-primary text-sm">
                                {formatINR(event.annualCtc)}
                              </span>
                              <span className="text-muted-foreground font-mono text-[11px]">
                                ({formatINR(event.monthlyInHand)}/mo in-hand)
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {event.hikePercentage !== null && (
                                <span className="font-mono font-semibold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  +{event.hikePercentage.toFixed(1)}% hike
                                </span>
                              )}

                              {(event.hikeCagr ?? event.hikeXirr) !== null && (event.hikeCagr ?? event.hikeXirr) !== undefined && (
                                <span
                                  className={cn(
                                    'font-mono font-semibold text-xs px-2 py-0.5 rounded-md border',
                                    isFinalHike
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                  )}
                                  title="Annualized growth rate (CAGR) for this revision"
                                >
                                  {(event.hikeCagr ?? event.hikeXirr)! >= 0 ? '+' : ''}{(event.hikeCagr ?? event.hikeXirr)!.toFixed(1)}% {isFinalHike ? 'Final Hike CAGR' : 'Hike CAGR'}
                                </span>
                              )}

                              <span className="text-[10px] text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md font-medium">
                                {event.cumulativeGrowth}% cumulative
                              </span>

                              {(event.cumulativeCagr ?? event.cumulativeXirr) !== null && (event.cumulativeCagr ?? event.cumulativeXirr) !== undefined && (
                                <span
                                  className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-md font-medium"
                                  title="Cumulative annualized return (Career CAGR) from baseline"
                                >
                                  {(event.cumulativeCagr ?? event.cumulativeXirr)! >= 0 ? '+' : ''}{(event.cumulativeCagr ?? event.cumulativeXirr)!.toFixed(1)}% Career CAGR
                                </span>
                              )}
                            </div>
                          </div>

                          {event.notes && (
                            <p className="text-[11px] text-muted-foreground italic pt-0.5">
                              “{event.notes}”
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Proration Calculator */}
          {activeTab === 'calculator' && (
            <SalaryProrationCalculator
              owners={owners}
              onSyncToIncomeGrowth={() => {
                toast.success('Synced to Income Growth! View your updated Financial Year records.')
              }}
            />
          )}
        </>
      )}

      {/* Add / Edit Salary Source Modal */}
      <AddSalarySourceModal
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        sourceToEdit={sourceToEdit}
        owners={owners}
        onSuccess={fetchData}
      />

      {/* Add / Edit Salary Revision Modal */}
      <AddSalaryRevisionModal
        open={isAddRevisionOpen}
        onOpenChange={setIsAddRevisionOpen}
        salarySources={sources}
        defaultSourceId={revisionSourceId}
        revisionToEdit={revisionToEdit}
        onSuccess={fetchData}
      />

      {/* Confirm Delete Source Dialog */}
      <ConfirmDialog
        open={!!sourceToDelete}
        onOpenChange={(open) => !open && setSourceToDelete(null)}
        title={`Delete ${sourceToDelete?.companyName}?`}
        description={`This will permanently remove ${sourceToDelete?.companyName} and all associated salary revision history.`}
        confirmLabel="Delete Source"
        destructive
        loading={isDeletingSource}
        onConfirm={handleDeleteSource}
      />

      {/* Confirm Delete Revision Dialog */}
      <ConfirmDialog
        open={!!revisionToDelete}
        onOpenChange={(open) => !open && setRevisionToDelete(null)}
        title="Delete Salary Revision?"
        description="This will remove this compensation revision record."
        confirmLabel="Delete Revision"
        destructive
        loading={isDeletingRevision}
        onConfirm={handleDeleteRevision}
      />
    </div>
  )
}

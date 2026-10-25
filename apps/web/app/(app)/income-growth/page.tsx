'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Loader2,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  Users,
  Coins,
  Receipt,
  Percent,
  Calculator,
  ArrowUpRight,
  Briefcase,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StatCard } from '@/components/ui/custom/StatCard'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { IncomeGrowthChart, type IncomeChartRecord } from '@/components/income-growth/IncomeGrowthChart'
import { AddIncomeModal } from '@/components/income-growth/AddIncomeModal'

interface Owner {
  id: string
  name: string
  color: string
}

interface IncomeRecord extends IncomeChartRecord {
  userId: string
  ownerId?: string | null
  taxPaid: string
  netIncome: string
  grossIncome: string
  notes?: string | null
  yoyGrowthAmount: number
  yoyNetGrowthPercentage: number | null
  owner?: Owner | null
}

interface IncomeGrowthResponse {
  records: IncomeRecord[]
  summary: {
    totalRecords: number
    latestGrossIncome: number
    latestNetIncome: number
    latestTaxPaid: number
    latestYoYGrowth: number | null
    averageAnnualGross: number
    cagr: number | null
    overallMultiplier: number | null
    totalCumulativeGross: number
    totalCumulativeTax: number
    totalCumulativeNet: number
  }
}

export default function IncomeGrowthPage() {
  const [data, setData] = useState<IncomeGrowthResponse | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [recordToEdit, setRecordToEdit] = useState<IncomeRecord | null>(null)
  const [recordToDelete, setRecordToDelete] = useState<IncomeRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch household owners
  useEffect(() => {
    apiClient
      .fetch<Owner[]>('/v1/owners')
      .then(setOwners)
      .catch((err) => console.error('Failed to load owners:', err))
  }, [])

  // Fetch financial year incomes
  const fetchIncomes = async () => {
    setIsLoading(true)
    try {
      const query = selectedOwnerId !== 'all' ? `?ownerId=${selectedOwnerId}` : ''
      const res = await apiClient.fetch<IncomeGrowthResponse>(`/v1/income-growth${query}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to fetch income growth:', err)
      toast.error(err.message || 'Failed to load income growth records')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchIncomes()
  }, [selectedOwnerId])

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return
    setIsDeleting(true)
    try {
      await apiClient.fetch(`/v1/income-growth/${recordToDelete.id}`, {
        method: 'DELETE',
      })
      toast.success(`Removed income record for ${recordToDelete.financialYear}`)
      setRecordToDelete(null)
      fetchIncomes()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to delete income record')
    } finally {
      setIsDeleting(false)
    }
  }

  const summary = data?.summary
  const records = data?.records || []

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Income Growth</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Financial Years
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track your financial year earnings, YoY growth rate, and lifetime income trajectory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/salary-progress">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              Salary Progress
            </Button>
          </Link>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs shadow-xs"
            onClick={() => {
              setRecordToEdit(null)
              setIsAddModalOpen(true)
            }}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Financial Year
          </Button>
        </div>
      </div>

      {/* Owner / Household Filter Bar */}
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

      {/* Loading state */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        /* Empty State */
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Coins className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Financial Year Income Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Keep track of how much you earned each financial year (e.g., FY 2024-25, FY 2023-24). You can also automatically compute earnings from your Salary Progress.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => {
                setRecordToEdit(null)
                setIsAddModalOpen(true)
              }}
              className="gap-1.5 text-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add First Financial Year
            </Button>
            <Link href="/salary-progress">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" />
                Configure Salary Progress
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Latest Gross Income"
              value={formatINR(summary?.latestGrossIncome ?? 0)}
              subLabel={records[records.length - 1]?.financialYear || 'Latest FY'}
              trend={
                summary?.latestYoYGrowth !== null && summary?.latestYoYGrowth !== undefined
                  ? summary.latestYoYGrowth >= 0
                    ? 'up'
                    : 'down'
                  : 'neutral'
              }
              trendValue={
                summary?.latestYoYGrowth !== null && summary?.latestYoYGrowth !== undefined
                  ? `${summary.latestYoYGrowth >= 0 ? '+' : ''}${summary.latestYoYGrowth.toFixed(1)}% YoY`
                  : undefined
              }
              valueColor="green"
              icon={<Coins className="h-4 w-4" />}
            />

            <StatCard
              label="Latest Net In-Hand"
              value={formatINR(summary?.latestNetIncome ?? 0)}
              subLabel={`Effective Tax: ${
                records.length > 0 ? records[records.length - 1]!.effectiveTaxRate.toFixed(1) : 0
              }%`}
              icon={<Receipt className="h-4 w-4" />}
            />

            <StatCard
              label="Income CAGR"
              value={
                summary?.cagr !== null && summary?.cagr !== undefined
                  ? `${summary.cagr >= 0 ? '+' : ''}${summary.cagr.toFixed(1)}%`
                  : summary?.overallMultiplier
                  ? `${summary.overallMultiplier.toFixed(1)}x`
                  : 'N/A'
              }
              subLabel={
                summary?.overallMultiplier
                  ? `${summary.overallMultiplier.toFixed(1)}x overall growth`
                  : `${records.length} financial years recorded`
              }
              valueColor={
                summary?.cagr && summary.cagr >= 0
                  ? 'green'
                  : summary?.cagr && summary.cagr < 0
                  ? 'red'
                  : 'default'
              }
              icon={<Percent className="h-4 w-4" />}
            />

            <StatCard
              label="Cumulative Gross"
              value={formatINR(summary?.totalCumulativeGross ?? 0)}
              subLabel={`Total Tax Paid: ${formatINR(summary?.totalCumulativeTax ?? 0)}`}
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            />
          </div>

          {/* Interactive Chart */}
          <IncomeGrowthChart records={records} />

          {/* Financial Years Records Table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Financial Year Records</h3>
                <p className="text-xs text-muted-foreground">
                  History of annual earnings, taxes, and year-over-year compensation growth
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setRecordToEdit(null)
                  setIsAddModalOpen(true)
                }}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add FY
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Financial Year</th>
                    <th className="py-3 px-4">Gross Income</th>
                    <th className="py-3 px-4">Tax Paid (TDS)</th>
                    <th className="py-3 px-4">Net In-Hand</th>
                    <th className="py-3 px-4">YoY Growth</th>
                    <th className="py-3 px-4 hidden md:table-cell">Breakdown / Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...records].reverse().map((record) => {
                    const isPositiveYoY =
                      record.yoyGrowthPercentage !== null && record.yoyGrowthPercentage >= 0
                    const hasBreakdown =
                      record.breakdown && Object.keys(record.breakdown).length > 0

                    return (
                      <tr key={record.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm font-mono">
                              {record.financialYear}
                            </span>
                            {record.owner && (
                              <span
                                className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border"
                                style={{
                                  borderColor: `${record.owner.color}40`,
                                  backgroundColor: `${record.owner.color}15`,
                                  color: record.owner.color,
                                }}
                              >
                                {record.owner.name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium text-foreground text-sm">
                          {formatINR(record.grossIncomeNumber)}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          {formatINR(record.taxPaidNumber)}
                          <span className="text-[10px] ml-1.5 text-muted-foreground/75">
                            ({record.effectiveTaxRate.toFixed(1)}%)
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {formatINR(record.netIncomeNumber)}
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          {record.yoyGrowthPercentage !== null ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-semibold text-xs',
                                isPositiveYoY
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {isPositiveYoY ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                              )}
                              {isPositiveYoY ? '+' : ''}
                              {record.yoyGrowthPercentage.toFixed(1)}%
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                ({isPositiveYoY ? '+' : ''}
                                {formatINR(record.yoyGrowthAmount)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">Baseline</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 hidden md:table-cell max-w-xs truncate">
                          {hasBreakdown ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(record.breakdown!)
                                .filter(([_, amt]) => !!amt && amt > 0)
                                .map(([key, amt]) => (
                                  <span
                                    key={key}
                                    className="inline-block bg-muted/60 text-[10px] px-1.5 py-0.5 rounded text-foreground/80 font-mono capitalize"
                                  >
                                    {key}: {formatINR(amt)}
                                  </span>
                                ))}
                            </div>
                          ) : record.notes ? (
                            <span className="text-muted-foreground text-xs truncate block" title={record.notes}>
                              {record.notes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setRecordToEdit(record)
                                setIsAddModalOpen(true)
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setRecordToDelete(record)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Financial Year Income Modal */}
      <AddIncomeModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        recordToEdit={recordToEdit}
        existingRecords={records}
        owners={owners}
        onSuccess={fetchIncomes}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!recordToDelete}
        onOpenChange={(open) => !open && setRecordToDelete(null)}
        title={`Delete ${recordToDelete?.financialYear} Income?`}
        description={`This will permanently remove the recorded income of ${formatINR(
          recordToDelete?.grossIncomeNumber || 0
        )} for ${recordToDelete?.financialYear}.`}
        confirmLabel="Delete Record"
        destructive
        loading={isDeleting}
        onConfirm={handleDeleteRecord}
      />
    </div>
  )
}

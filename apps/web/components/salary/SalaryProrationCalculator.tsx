'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { toast } from 'sonner'
import { Calculator, ArrowRight, Loader2, Sparkles, Check, Calendar, TrendingUp, AlertCircle, PlusCircle } from 'lucide-react'
import { ExistingFYConfirmDialog } from '@/components/income-growth/ExistingFYConfirmDialog'

interface Owner {
  id: string
  name: string
  color: string
}

interface PeriodBreakdown {
  startDate: string
  endDate: string
  days: number
  annualCtc: number
  monthlyInHand: number
  effectiveRateEarned: number
  hikeType?: string
  designation?: string
}

interface SourceBreakdown {
  sourceId: string
  companyName: string
  role: string
  earnedInFY: number
  periods: PeriodBreakdown[]
}

interface ExistingFYRecord {
  id: string
  financialYear: string
  ownerId?: string | null
  grossIncome: number
  taxPaid: number
  netIncome: number
  breakdown?: Record<string, number> | null
  notes?: string | null
  ownerName?: string | null
}

interface ProrationResult {
  financialYear: string
  fyStart: string
  fyEnd: string
  totalEarnedSalary: number
  totalEstimatedInHand: number
  sourceBreakdowns: SourceBreakdown[]
  existingIncomeRecord?: ExistingFYRecord | null
}

interface SalaryProrationCalculatorProps {
  owners: Owner[]
  onSyncToIncomeGrowth?: (fy: string, earnedSalary: number, inHand: number) => void
}

const FY_OPTIONS = [
  'FY 2025-26',
  'FY 2024-25',
  'FY 2023-24',
  'FY 2022-23',
  'FY 2021-22',
  'FY 2020-21',
]

export function SalaryProrationCalculator({ owners, onSyncToIncomeGrowth }: SalaryProrationCalculatorProps) {
  const [financialYear, setFinancialYear] = useState('FY 2024-25')
  const [ownerId, setOwnerId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ProrationResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const [showMergeConfirm, setShowMergeConfirm] = useState(false)

  const handleCalculate = async () => {
    setIsLoading(true)
    try {
      const selectedOwner = ownerId !== 'all' ? ownerId : undefined
      const data = await apiClient.fetch<ProrationResult>('/v1/income-growth/calculate-from-salary', {
        method: 'POST',
        body: JSON.stringify({
          financialYear,
          ownerId: selectedOwner,
        }),
      })
      setResult(data)
      if (data.totalEarnedSalary === 0) {
        toast.info(`No salary records or revisions found overlapping with ${financialYear}`)
      } else {
        toast.success(`Calculated earned salary: ${formatINR(data.totalEarnedSalary)}`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Calculation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const executeSync = async (mode: 'add' | 'overwrite' | 'create') => {
    if (!result || result.totalEarnedSalary <= 0) return
    setIsSyncing(true)
    setShowMergeConfirm(false)
    try {
      const taxEstimated = Math.max(0, result.totalEarnedSalary - result.totalEstimatedInHand)
      const bd = { salary: result.totalEarnedSalary }

      await apiClient.fetch('/v1/income-growth', {
        method: 'POST',
        body: JSON.stringify({
          financialYear: result.financialYear,
          ownerId: ownerId !== 'all' ? ownerId : null,
          grossIncome: result.totalEarnedSalary,
          taxPaid: taxEstimated,
          netIncome: result.totalEstimatedInHand > 0 ? result.totalEstimatedInHand : result.totalEarnedSalary,
          breakdown: bd,
          notes: `Synced from Salary Progress (${result.sourceBreakdowns.map((s) => s.companyName).join(', ')})`,
          mode,
        }),
      })

      if (mode === 'add') {
        toast.success(`Successfully added ${formatINR(result.totalEarnedSalary)} to existing ${result.financialYear} in Income Growth!`)
      } else if (mode === 'overwrite') {
        toast.success(`Updated ${result.financialYear} in Income Growth with calculated salary!`)
      } else {
        toast.success(`Successfully saved ${result.financialYear} into Income Growth!`)
      }

      if (onSyncToIncomeGrowth) {
        onSyncToIncomeGrowth(result.financialYear, result.totalEarnedSalary, result.totalEstimatedInHand)
      }

      // Update existing record state locally
      setResult((prev) => {
        if (!prev) return null
        const prevExisting = prev.existingIncomeRecord
        const prevGross = prevExisting ? prevExisting.grossIncome : 0
        const prevTax = prevExisting ? prevExisting.taxPaid : 0
        const prevNet = prevExisting ? prevExisting.netIncome : 0
        return {
          ...prev,
          existingIncomeRecord: {
            id: prevExisting?.id || 'synced',
            financialYear: prev.financialYear,
            ownerId: ownerId !== 'all' ? ownerId : null,
            grossIncome: mode === 'add' ? prevGross + prev.totalEarnedSalary : prev.totalEarnedSalary,
            taxPaid: mode === 'add' ? prevTax + taxEstimated : taxEstimated,
            netIncome:
              mode === 'add'
                ? prevNet + (prev.totalEstimatedInHand || prev.totalEarnedSalary)
                : prev.totalEstimatedInHand || prev.totalEarnedSalary,
            breakdown: bd,
            notes: `Synced from Salary Progress`,
          },
        }
      })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to sync with Income Growth')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncToIncomeGrowth = async () => {
    if (!result || result.totalEarnedSalary <= 0) return
    if (result.existingIncomeRecord) {
      setShowMergeConfirm(true)
    } else {
      await executeSync('create')
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Mid-Year Hike & Financial Year Proration Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calculates exact earned income by prorating compensation across mid-year revisions and multiple employers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={financialYear} onValueChange={(val) => { if (val) setFinancialYear(val); }}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FY_OPTIONS.map((fy) => (
                <SelectItem key={fy} value={fy} className="text-xs">
                  {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {owners.length > 0 && (
            <Select value={ownerId} onValueChange={(val) => { if (val) setOwnerId(val); }}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Members
                </SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id} className="text-xs">
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={handleCalculate}
            disabled={isLoading}
            className="h-8 text-xs gap-1.5 shadow-xs"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
            Calculate
          </Button>
        </div>
      </div>

      {/* Results Display */}
      {result ? (
        <div className="space-y-4">
          {result.existingIncomeRecord && (
            <div className="flex items-start justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{result.financialYear}</strong> already has data in Income Growth ({formatINR(result.existingIncomeRecord.grossIncome)} gross). Syncing will ask to add to the present FY to avoid double entries.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                Total Earned in {result.financialYear}
              </span>
              <p className="text-2xl font-bold font-mono text-primary">
                {formatINR(result.totalEarnedSalary)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Prorated from {result.fyStart} to {result.fyEnd}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Estimated Net In-Hand
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(result.totalEstimatedInHand)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Estimated post-deductions cash flow
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Sync to Income Growth
                </span>
                <p className="text-xs text-muted-foreground">
                  Record this directly in your Financial Year income tracker
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 mt-2"
                onClick={handleSyncToIncomeGrowth}
                disabled={isSyncing || result.totalEarnedSalary === 0}
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Sync to Income Growth
              </Button>
            </div>
          </div>

          {/* Breakdown by source and hike periods */}
          {result.sourceBreakdowns.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Period-by-Period Hike Breakdown
              </h4>

              <div className="space-y-3">
                {result.sourceBreakdowns.map((source) => (
                  <div key={source.sourceId} className="border border-border/80 rounded-xl overflow-hidden bg-card">
                    <div className="p-3 bg-muted/30 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm text-foreground">{source.companyName}</span>
                        <span className="text-xs text-muted-foreground ml-2">({source.role})</span>
                      </div>
                      <span className="font-mono font-bold text-sm text-primary">
                        {formatINR(source.earnedInFY)}
                      </span>
                    </div>

                    <div className="p-3 overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[10px] uppercase font-medium text-muted-foreground border-b border-border/50">
                          <tr>
                            <th className="pb-1.5">Period (Dates)</th>
                            <th className="pb-1.5">Days</th>
                            <th className="pb-1.5">Annual CTC Rate</th>
                            <th className="pb-1.5">Monthly In-Hand</th>
                            <th className="pb-1.5">Hike Type</th>
                            <th className="pb-1.5 text-right">Earned in Period</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {source.periods.map((period, idx) => (
                            <tr key={idx} className="hover:bg-muted/15">
                              <td className="py-2 text-foreground font-sans">
                                {period.startDate} to {period.endDate}
                              </td>
                              <td className="py-2 text-muted-foreground">{period.days} days</td>
                              <td className="py-2 font-medium text-foreground">{formatINR(period.annualCtc)}</td>
                              <td className="py-2 text-muted-foreground">{formatINR(period.monthlyInHand)}</td>
                              <td className="py-2 font-sans capitalize text-xs">
                                <span className="inline-block bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">
                                  {period.hikeType?.replace('_', ' ') || 'Revision'}
                                </span>
                              </td>
                              <td className="py-2 text-right font-semibold text-primary">
                                {formatINR(period.effectiveRateEarned)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-muted/20 border border-dashed border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Select a Financial Year above and click <span className="font-semibold text-foreground">Calculate</span> to see exact prorated earnings accounting for all mid-year hikes.
          </p>
        </div>
      )}

      {/* Confirmation Dialog to Add to Present FY vs Overwrite */}
      {result && result.existingIncomeRecord && (
        <ExistingFYConfirmDialog
          open={showMergeConfirm}
          onOpenChange={setShowMergeConfirm}
          financialYear={result.financialYear}
          existingData={{
            grossIncome: result.existingIncomeRecord.grossIncome,
            netIncome: result.existingIncomeRecord.netIncome,
            taxPaid: result.existingIncomeRecord.taxPaid,
            notes: result.existingIncomeRecord.notes,
            ownerName: result.existingIncomeRecord.ownerName,
          }}
          newData={{
            grossIncome: result.totalEarnedSalary,
            netIncome: result.totalEstimatedInHand || result.totalEarnedSalary,
            taxPaid: Math.max(0, result.totalEarnedSalary - result.totalEstimatedInHand),
            title: 'Calculated Salary',
          }}
          onAddToPresentFY={() => executeSync('add')}
          onOverwritePresentFY={() => executeSync('overwrite')}
          isLoading={isSyncing}
        />
      )}
    </div>
  )
}

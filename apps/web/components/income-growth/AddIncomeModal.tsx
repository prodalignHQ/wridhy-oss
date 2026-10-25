'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, Sparkles, ChevronDown, ChevronUp, Calculator, AlertCircle, PlusCircle } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { ExistingFYConfirmDialog } from './ExistingFYConfirmDialog'

interface Owner {
  id: string
  name: string
  color: string
}

interface IncomeRecord {
  id: string
  ownerId?: string | null
  financialYear: string
  grossIncome: string
  taxPaid: string
  netIncome: string
  breakdown?: {
    salary?: number
    bonus?: number
    business?: number
    investments?: number
    rental?: number
    freelance?: number
    other?: number
  } | null
  notes?: string | null
  owner?: Owner | null
}

interface AddIncomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordToEdit?: IncomeRecord | null
  existingRecords?: IncomeRecord[]
  owners: Owner[]
  onSuccess: () => void
}

// Calculate current financial year start year (Indian FY starts April 1)
function getCurrentFYStartYear(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0 = Jan, 3 = April
  return month >= 3 ? year : year - 1
}

// Given YY (e.g. "2024" or "24"), compute ZZ (YY+1) and the formatted "FY YYYY-ZZ" string
export function computeFYFromInput(input: string): {
  fullStartYear: number | null
  zz: string
  fullFY: string
} {
  const clean = input.replace(/^FY\s*/i, '').trim()
  if (!clean) return { fullStartYear: null, zz: '', fullFY: '' }

  const firstPart = clean.split(/[-/]/)[0]?.trim() || ''
  const num = parseInt(firstPart, 10)
  if (isNaN(num) || num <= 0) return { fullStartYear: null, zz: '', fullFY: '' }

  let fullStartYear = num
  if (firstPart.length <= 2) {
    fullStartYear = 2000 + num
  }

  // Calculate ZZ = (YY + 1)
  const nextYear = fullStartYear + 1
  const zz = String(nextYear % 100).padStart(2, '0')
  const fullFY = `FY ${fullStartYear}-${zz}`

  return { fullStartYear, zz, fullFY }
}

export function AddIncomeModal({
  open,
  onOpenChange,
  recordToEdit,
  existingRecords,
  owners,
  onSuccess,
}: AddIncomeModalProps) {
  const isEditing = !!recordToEdit

  const [startYearInput, setStartYearInput] = useState<string>(() => String(getCurrentFYStartYear()))
  const [ownerId, setOwnerId] = useState<string>('none')
  const [grossIncome, setGrossIncome] = useState('')
  const [taxPaid, setTaxPaid] = useState('0')
  const [netIncome, setNetIncome] = useState('')
  const [notes, setNotes] = useState('')
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Derived financial year from startYearInput: ZZ = YY + 1
  const { fullStartYear, zz, fullFY } = computeFYFromInput(startYearInput)

  // Breakdown fields
  const [salary, setSalary] = useState('')
  const [bonus, setBonus] = useState('')
  const [business, setBusiness] = useState('')
  const [investments, setInvestments] = useState('')
  const [rental, setRental] = useState('')
  const [freelance, setFreelance] = useState('')
  const [other, setOther] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatingSalary, setIsCalculatingSalary] = useState(false)

  // Check if an existing record matches the selected FY and owner
  const matchedExistingRecord = useMemo(() => {
    if (recordToEdit || !fullFY) return null
    const norm = fullFY.replace(/\s+/g, '').toUpperCase()
    return (
      (existingRecords || []).find((r) => {
        const rNorm = r.financialYear.replace(/\s+/g, '').toUpperCase()
        if (rNorm !== norm) return false
        if (ownerId && ownerId !== 'none') {
          return r.ownerId === ownerId
        }
        return !r.ownerId
      }) || null
    )
  }, [recordToEdit, fullFY, ownerId, existingRecords])

  // Dialog state for confirming add to present FY vs overwrite
  const [confirmDialogData, setConfirmDialogData] = useState<{
    open: boolean
    type: 'calculate' | 'submit'
    financialYear: string
    existingData: {
      grossIncome: number
      netIncome?: number
      taxPaid?: number
      notes?: string | null
      ownerName?: string | null
    }
    newData: {
      grossIncome: number
      netIncome?: number
      taxPaid?: number
      title?: string
    }
    pendingCalculateResult?: {
      res: any
      baseGross: number
      baseTax: number
      baseNet: number
      baseSalary: number
    }
  } | null>(null)

  // Populate state when opening in edit mode
  useEffect(() => {
    if (recordToEdit) {
      const match = recordToEdit.financialYear.match(/(\d{4})/)
      if (match && match[1]) {
        setStartYearInput(match[1])
      } else {
        const match2 = recordToEdit.financialYear.match(/(\d{2})/)
        if (match2 && match2[1]) {
          setStartYearInput(String(2000 + parseInt(match2[1], 10)))
        } else {
          setStartYearInput(recordToEdit.financialYear)
        }
      }
      setOwnerId(recordToEdit.ownerId || 'none')
      setGrossIncome(recordToEdit.grossIncome)
      setTaxPaid(recordToEdit.taxPaid)
      setNetIncome(recordToEdit.netIncome)
      setNotes(recordToEdit.notes || '')

      const bd = recordToEdit.breakdown || {}
      setSalary(bd.salary ? String(bd.salary) : '')
      setBonus(bd.bonus ? String(bd.bonus) : '')
      setBusiness(bd.business ? String(bd.business) : '')
      setInvestments(bd.investments ? String(bd.investments) : '')
      setRental(bd.rental ? String(bd.rental) : '')
      setFreelance(bd.freelance ? String(bd.freelance) : '')
      setOther(bd.other ? String(bd.other) : '')
      if (Object.keys(bd).length > 0) setShowBreakdown(true)
    } else {
      setStartYearInput(String(getCurrentFYStartYear()))
      setOwnerId(owners[0]?.id || 'none')
      setGrossIncome('')
      setTaxPaid('0')
      setNetIncome('')
      setNotes('')
      setSalary('')
      setBonus('')
      setBusiness('')
      setInvestments('')
      setRental('')
      setFreelance('')
      setOther('')
      setShowBreakdown(false)
    }
  }, [recordToEdit, open, owners])

  // Automatically compute net income when gross or tax changes (unless editing existing manually)
  const handleGrossChange = (val: string) => {
    setGrossIncome(val)
    const g = parseFloat(val) || 0
    const t = parseFloat(taxPaid) || 0
    setNetIncome(String(Math.max(0, g - t)))
  }

  const handleTaxChange = (val: string) => {
    setTaxPaid(val)
    const g = parseFloat(grossIncome) || 0
    const t = parseFloat(val) || 0
    setNetIncome(String(Math.max(0, g - t)))
  }

  const handleStartYearChange = (val: string) => {
    const clean = val.replace(/^FY\s*/i, '').trim()
    const firstPart = clean.split(/[-/]/)[0]?.trim() || ''
    const digitsOnly = firstPart.replace(/\D/g, '').slice(0, 4)
    setStartYearInput(digitsOnly)
  }

  const handleStartYearBlur = () => {
    if (fullStartYear) {
      setStartYearInput(String(fullStartYear))
    }
  }

  const handleYearStep = (delta: number) => {
    const baseYear = fullStartYear ?? getCurrentFYStartYear()
    const nextYear = Math.max(1990, Math.min(2100, baseYear + delta))
    setStartYearInput(String(nextYear))
  }

  const applyCalculatedSalary = (
    res: any,
    mode: 'add' | 'overwrite',
    baseGross: number,
    baseTax: number,
    baseNet: number,
    baseSalary: number
  ) => {
    const estimatedTax = Math.max(0, res.totalEarnedSalary - res.totalEstimatedInHand)
    const earnedSalary = res.totalEarnedSalary
    const estimatedNet = res.totalEstimatedInHand > 0 ? res.totalEstimatedInHand : earnedSalary

    const sourcesSummary = res.sourceBreakdowns
      .map(
        (s: any) =>
          `${s.companyName}: ${formatINR(s.earnedInFY)} (${s.periods.length} revision period${s.periods.length > 1 ? 's' : ''})`
      )
      .join(', ')

    if (mode === 'add') {
      const finalGross = baseGross + earnedSalary
      const finalTax = baseTax + estimatedTax
      const finalNet = baseNet + estimatedNet
      const finalSalary = baseSalary + earnedSalary

      setGrossIncome(String(finalGross))
      setTaxPaid(String(finalTax))
      setNetIncome(String(finalNet))
      setSalary(String(finalSalary))
      setShowBreakdown(true)

      setNotes((prev) =>
        prev
          ? `${prev}\nAdded from Salary Progress: ${sourcesSummary}`
          : `Added from Salary Progress: ${sourcesSummary}`
      )
      toast.success(`Added ${formatINR(earnedSalary)} to present FY data!`)
    } else {
      setGrossIncome(String(earnedSalary))
      setSalary(String(earnedSalary))
      setTaxPaid(String(estimatedTax))
      setNetIncome(String(estimatedNet))
      setShowBreakdown(true)

      setNotes((prev) =>
        prev
          ? `${prev}\nCalculated from Salary Progress: ${sourcesSummary}`
          : `Calculated from Salary Progress: ${sourcesSummary}`
      )
      toast.success(`Loaded ${formatINR(earnedSalary)} from Salary Progress!`)
    }
  }

  // Auto-fill from Salary Progress
  const handleCalculateFromSalary = async () => {
    if (!fullFY) {
      toast.error('Please enter a valid starting year for the Financial Year first')
      return
    }

    setIsCalculatingSalary(true)
    try {
      const selectedOwner = ownerId !== 'none' ? ownerId : undefined
      const res = await apiClient.fetch<any>('/v1/income-growth/calculate-from-salary', {
        method: 'POST',
        body: JSON.stringify({
          financialYear: fullFY,
          ownerId: selectedOwner,
        }),
      })

      if (res && res.totalEarnedSalary > 0) {
        const currentFormGross = parseFloat(grossIncome) || 0
        const currentFormTax = parseFloat(taxPaid) || 0
        const currentFormNet = parseFloat(netIncome) || 0
        const currentFormSalary = parseFloat(salary) || 0

        const existingRec = matchedExistingRecord || res.existingIncomeRecord

        if (currentFormGross > 0 || existingRec) {
          const baseGross = currentFormGross > 0 ? currentFormGross : parseFloat(existingRec?.grossIncome) || 0
          const baseTax = currentFormGross > 0 ? currentFormTax : parseFloat(existingRec?.taxPaid) || 0
          const baseNet = currentFormGross > 0 ? currentFormNet : parseFloat(existingRec?.netIncome) || 0
          const baseSalary = currentFormSalary > 0 ? currentFormSalary : existingRec?.breakdown?.salary || 0

          setConfirmDialogData({
            open: true,
            type: 'calculate',
            financialYear: fullFY,
            existingData: {
              grossIncome: baseGross,
              netIncome: baseNet,
              taxPaid: baseTax,
              notes: existingRec?.notes || notes,
              ownerName: existingRec?.owner?.name || existingRec?.ownerName,
            },
            newData: {
              grossIncome: res.totalEarnedSalary,
              netIncome: res.totalEstimatedInHand || res.totalEarnedSalary,
              taxPaid: Math.max(0, res.totalEarnedSalary - res.totalEstimatedInHand),
              title: 'Calculated Salary',
            },
            pendingCalculateResult: {
              res,
              baseGross,
              baseTax,
              baseNet,
              baseSalary,
            },
          })
        } else {
          applyCalculatedSalary(res, 'overwrite', 0, 0, 0, 0)
        }
      } else {
        toast.info(`No active salary revisions found for ${fullFY}. Add salary sources and hikes in the Salary Progress menu first.`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to calculate salary from Salary Progress')
    } finally {
      setIsCalculatingSalary(false)
    }
  }

  const executeSubmit = async (mode: 'create' | 'add' | 'overwrite') => {
    const gross = parseFloat(grossIncome)
    const tax = parseFloat(taxPaid) || 0
    const net = parseFloat(netIncome) || Math.max(0, gross - tax)

    const bd: Record<string, number> = {}
    if (salary) bd['salary'] = parseFloat(salary)
    if (bonus) bd['bonus'] = parseFloat(bonus)
    if (business) bd['business'] = parseFloat(business)
    if (investments) bd['investments'] = parseFloat(investments)
    if (rental) bd['rental'] = parseFloat(rental)
    if (freelance) bd['freelance'] = parseFloat(freelance)
    if (other) bd['other'] = parseFloat(other)

    setIsSubmitting(true)
    try {
      const payload = {
        ownerId: ownerId !== 'none' ? ownerId : null,
        financialYear: fullFY,
        grossIncome: gross,
        taxPaid: tax,
        netIncome: net,
        breakdown: Object.keys(bd).length > 0 ? bd : undefined,
        notes: notes.trim() || null,
        mode,
      }

      if (isEditing) {
        await apiClient.fetch(`/v1/income-growth/${recordToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Financial Year income updated successfully')
      } else {
        await apiClient.fetch('/v1/income-growth', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (mode === 'add') {
          toast.success(`Successfully added to existing ${fullFY}!`)
        } else if (mode === 'overwrite') {
          toast.success(`Updated ${fullFY} successfully!`)
        } else {
          toast.success('Financial Year income recorded successfully')
        }
      }

      setConfirmDialogData(null)
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save financial year income')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullFY) {
      toast.error('Please enter a valid financial year (e.g. 2024 or 24)')
      return
    }

    const gross = parseFloat(grossIncome)
    if (isNaN(gross) || gross < 0) {
      toast.error('Please enter a valid gross income')
      return
    }

    const tax = parseFloat(taxPaid) || 0
    const net = parseFloat(netIncome) || Math.max(0, gross - tax)

    // If creating a new record, but this FY already has existing data:
    if (!isEditing && matchedExistingRecord) {
      setConfirmDialogData({
        open: true,
        type: 'submit',
        financialYear: fullFY,
        existingData: {
          grossIncome: parseFloat(matchedExistingRecord.grossIncome) || 0,
          netIncome: parseFloat(matchedExistingRecord.netIncome) || 0,
          taxPaid: parseFloat(matchedExistingRecord.taxPaid) || 0,
          notes: matchedExistingRecord.notes,
          ownerName: matchedExistingRecord.owner?.name,
        },
        newData: {
          grossIncome: gross,
          netIncome: net,
          taxPaid: tax,
          title: 'New Entry',
        },
      })
      return
    }

    await executeSubmit('create')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit Financial Year Income' : 'Record Financial Year Income'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter your annual financial year income details. You can also auto-calculate earnings from your Salary Progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick Auto-Fill Action */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/8 border border-primary/20">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" />
                  Have salary sources with hikes?
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Calculate weighted earnings based on mid-year hikes
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                onClick={handleCalculateFromSalary}
                disabled={isCalculatingSalary}
              >
                {isCalculatingSalary ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Calculate from Salary
              </Button>
            </div>

            {/* Financial Year & Owner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="startYearInput" className="text-xs font-medium text-foreground">
                    Financial Year <span className="text-destructive">*</span>
                  </Label>
                  {fullFY && (
                    <span className="text-[11px] font-mono font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {fullFY}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center flex-1 h-9 rounded-md border border-input bg-background px-3 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors">
                    <span className="text-xs font-semibold text-muted-foreground select-none mr-2">
                      FY
                    </span>
                    <input
                      id="startYearInput"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 2024 or 24"
                      value={startYearInput}
                      onChange={(e) => handleStartYearChange(e.target.value)}
                      onBlur={handleStartYearBlur}
                      className="w-full bg-transparent text-xs font-mono outline-none text-foreground placeholder:text-muted-foreground"
                      required
                    />
                    <span className="text-xs font-mono font-medium text-muted-foreground select-none ml-2 whitespace-nowrap">
                      {zz ? `-${zz}` : '-ZZ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleYearStep(-1)}
                      title="Previous Year (YY - 1)"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleYearStep(1)}
                      title="Next Year (YY + 1)"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Given YY (e.g. 2024 or 24), ZZ is calculated as YY+1 ({zz ? `-${zz}` : '-ZZ'}).
                </p>
              </div>

              {owners.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="owner" className="text-xs font-medium text-foreground">
                    Household Member
                  </Label>
                  <Select value={ownerId} onValueChange={(val) => { if (val) setOwnerId(val); }}>
                    <SelectTrigger id="owner" className="h-9 text-xs">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        All / Shared
                      </SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id} className="text-xs">
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Existing FY Record Warning Banner */}
            {matchedExistingRecord && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs">
                    Data already exists for {matchedExistingRecord.financialYear}
                  </p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Present Gross: <span className="font-mono font-medium">{formatINR(parseFloat(matchedExistingRecord.grossIncome))}</span> | Net: <span className="font-mono font-medium">{formatINR(parseFloat(matchedExistingRecord.netIncome))}</span>.
                    You can add to this FY to avoid double entries and preserve accurate trajectory calculations.
                  </p>
                </div>
              </div>
            )}

            {/* Incomes: Gross, Tax, Net */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="grossIncome" className="text-xs font-medium text-foreground">
                  Gross Income (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="grossIncome"
                  type="number"
                  placeholder="e.g. 1500000"
                  value={grossIncome}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="taxPaid" className="text-xs font-medium text-foreground">
                  Tax Paid (TDS) (₹)
                </Label>
                <Input
                  id="taxPaid"
                  type="number"
                  placeholder="e.g. 250000"
                  value={taxPaid}
                  onChange={(e) => handleTaxChange(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="netIncome" className="text-xs font-medium text-foreground">
                  Net / In-Hand (₹)
                </Label>
                <Input
                  id="netIncome"
                  type="number"
                  placeholder="e.g. 1250000"
                  value={netIncome}
                  onChange={(e) => setNetIncome(e.target.value)}
                  className="h-9 text-xs font-mono bg-muted/30"
                />
              </div>
            </div>

            {/* Income Breakdown Accordion */}
            <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60">
              <button
                type="button"
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                <span className="flex items-center gap-1.5">
                  <span>Source Breakdown (Optional)</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Salary, Bonus, Business, etc.
                  </span>
                </span>
                {showBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showBreakdown && (
                <div className="p-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-muted/15">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Salary</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Bonus / Incentives</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Business / Practice</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={business}
                      onChange={(e) => setBusiness(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Investments / Dividends</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={investments}
                      onChange={(e) => setInvestments(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Rental</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={rental}
                      onChange={(e) => setRental(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Freelance / Consulting</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={freelance}
                      onChange={(e) => setFreelance(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-3">
                    <Label className="text-[11px] text-muted-foreground">Other Income</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={other}
                      onChange={(e) => setOther(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                Notes & Remarks
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Promoted to Senior Lead in Oct, received 20% appraisal bonus"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs resize-none h-18"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEditing ? 'Save Changes' : 'Record FY Income'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Confirmation Dialog to Add to Present FY vs Overwrite */}
      {confirmDialogData && (
        <ExistingFYConfirmDialog
          open={confirmDialogData.open}
          onOpenChange={(open) => {
            if (!open) setConfirmDialogData(null)
          }}
          financialYear={confirmDialogData.financialYear}
          existingData={confirmDialogData.existingData}
          newData={confirmDialogData.newData}
          onAddToPresentFY={async () => {
            if (confirmDialogData.type === 'calculate' && confirmDialogData.pendingCalculateResult) {
              const { res, baseGross, baseTax, baseNet, baseSalary } = confirmDialogData.pendingCalculateResult
              applyCalculatedSalary(res, 'add', baseGross, baseTax, baseNet, baseSalary)
              setConfirmDialogData(null)
            } else if (confirmDialogData.type === 'submit') {
              await executeSubmit('add')
            }
          }}
          onOverwritePresentFY={async () => {
            if (confirmDialogData.type === 'calculate' && confirmDialogData.pendingCalculateResult) {
              const { res } = confirmDialogData.pendingCalculateResult
              applyCalculatedSalary(res, 'overwrite', 0, 0, 0, 0)
              setConfirmDialogData(null)
            } else if (confirmDialogData.type === 'submit') {
              await executeSubmit('overwrite')
            }
          }}
          isLoading={isSubmitting}
        />
      )}
    </Dialog>
  )
}

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
import { Loader2, TrendingUp, Calendar, Info } from 'lucide-react'
import { formatINR } from '@/lib/format'

interface SalarySource {
  id: string
  companyName: string
  role: string
  currentAnnualCtc: number
  revisions?: Array<{
    id: string
    annualCtcNumber?: number
    annualCtc?: string
    effectiveDate: string | Date
  }>
}

interface SalaryRevision {
  id: string
  salarySourceId: string
  effectiveDate: string | Date
  annualCtc: string
  baseSalary?: string | null
  monthlyInHand?: string | null
  variablePay?: string | null
  stockGrant?: string | null
  hikePercentage?: string | null
  hikeType: string
  designation?: string | null
  notes?: string | null
}

interface AddSalaryRevisionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  salarySources: SalarySource[]
  defaultSourceId?: string | null
  revisionToEdit?: SalaryRevision | null
  onSuccess: () => void
}

export function AddSalaryRevisionModal({
  open,
  onOpenChange,
  salarySources,
  defaultSourceId,
  revisionToEdit,
  onSuccess,
}: AddSalaryRevisionModalProps) {
  const isEditing = !!revisionToEdit

  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]!)
  const [annualCtc, setAnnualCtc] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [monthlyInHand, setMonthlyInHand] = useState('')
  const [variablePay, setVariablePay] = useState('')
  const [stockGrant, setStockGrant] = useState('')
  const [hikePercentage, setHikePercentage] = useState('')
  const [hikeType, setHikeType] = useState('mid_year_hike')
  const [designation, setDesignation] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Find currently active source
  const selectedSource = salarySources.find((s) => s.id === selectedSourceId)

  // Find date-wise baseline revision for currently entered effective date
  const { priorRevision, nextRevision } = useMemo(() => {
    if (!selectedSource || !selectedSource.revisions || selectedSource.revisions.length === 0) {
      return { priorRevision: null, nextRevision: null }
    }
    const targetTime = new Date(effectiveDate).getTime()
    if (isNaN(targetTime)) return { priorRevision: null, nextRevision: null }

    const otherRevs = selectedSource.revisions
      .filter((r) => r.id !== revisionToEdit?.id)
      .map((r) => {
        const time = new Date(r.effectiveDate).getTime()
        const ctc = r.annualCtcNumber || parseFloat((r as any).annualCtc) || 0
        return { ...r, time, ctc }
      })
      .filter((r) => !isNaN(r.time))

    const priors = otherRevs
      .filter((r) => r.time < targetTime)
      .sort((a, b) => b.time - a.time)

    const nexts = otherRevs
      .filter((r) => r.time > targetTime)
      .sort((a, b) => a.time - b.time)

    return {
      priorRevision: priors[0] || null,
      nextRevision: nexts[0] || null,
    }
  }, [selectedSource, effectiveDate, revisionToEdit])

  useEffect(() => {
    if (revisionToEdit) {
      setSelectedSourceId(revisionToEdit.salarySourceId)
      setEffectiveDate(
        typeof revisionToEdit.effectiveDate === 'string'
          ? revisionToEdit.effectiveDate.split('T')[0]!
          : new Date(revisionToEdit.effectiveDate).toISOString().split('T')[0]!
      )
      setAnnualCtc(revisionToEdit.annualCtc)
      setBaseSalary(revisionToEdit.baseSalary || '')
      setMonthlyInHand(revisionToEdit.monthlyInHand || '')
      setVariablePay(revisionToEdit.variablePay || '')
      setStockGrant(revisionToEdit.stockGrant || '')
      setHikePercentage(revisionToEdit.hikePercentage || '')
      setHikeType(revisionToEdit.hikeType || 'annual_review')
      setDesignation(revisionToEdit.designation || '')
      setNotes(revisionToEdit.notes || '')
    } else {
      const srcId = defaultSourceId || salarySources[0]?.id || ''
      setSelectedSourceId(srcId)
      setEffectiveDate(new Date().toISOString().split('T')[0]!)
      setAnnualCtc('')
      setBaseSalary('')
      setMonthlyInHand('')
      setVariablePay('')
      setStockGrant('')
      setHikePercentage('')
      setHikeType('mid_year_hike')
      setDesignation('')
      setNotes('')
    }
  }, [revisionToEdit, open, defaultSourceId, salarySources])

  // When effective date changes, recalculate hike % date-wise
  const handleDateChange = (val: string) => {
    setEffectiveDate(val)
    if (!selectedSource || !selectedSource.revisions) return
    const targetTime = new Date(val).getTime()
    if (isNaN(targetTime)) return

    const eligible = selectedSource.revisions
      .filter((r) => r.id !== revisionToEdit?.id)
      .map((r) => ({
        ...r,
        time: new Date(r.effectiveDate).getTime(),
        ctc: r.annualCtcNumber || parseFloat((r as any).annualCtc) || 0,
      }))
      .filter((r) => !isNaN(r.time) && r.time < targetTime)
      .sort((a, b) => b.time - a.time)

    const prior = eligible[0] || null
    const currentCtc = parseFloat(annualCtc) || 0

    if (prior && prior.ctc > 0 && currentCtc > 0) {
      const diff = currentCtc - prior.ctc
      const pct = (diff / prior.ctc) * 100
      setHikePercentage(pct.toFixed(1))
    } else if (eligible.length === 0) {
      setHikePercentage('')
    }
  }

  // When annual CTC changes, auto-calculate hike % vs previous chronological revision
  const handleCtcChange = (val: string) => {
    setAnnualCtc(val)
    const newCtc = parseFloat(val) || 0

    if (newCtc > 0 && !monthlyInHand) {
      setMonthlyInHand(String(Math.round(newCtc / 12)))
    }

    if (priorRevision && priorRevision.ctc > 0 && newCtc > 0) {
      const diff = newCtc - priorRevision.ctc
      const pct = (diff / priorRevision.ctc) * 100
      setHikePercentage(pct.toFixed(1))
    } else if (!priorRevision) {
      setHikePercentage('')
    }
  }

  // When hike % is manually changed, calculate new CTC from prior revision
  const handleHikePctChange = (val: string) => {
    setHikePercentage(val)
    const pct = parseFloat(val)
    if (!isNaN(pct) && priorRevision && priorRevision.ctc > 0) {
      const calculatedCtc = Math.round(priorRevision.ctc * (1 + pct / 100))
      setAnnualCtc(String(calculatedCtc))
      setMonthlyInHand(String(Math.round(calculatedCtc / 12)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSourceId) {
      toast.error('Please select a salary source')
      return
    }

    const ctcNum = parseFloat(annualCtc)
    if (isNaN(ctcNum) || ctcNum <= 0) {
      toast.error('Please enter a valid Annual CTC')
      return
    }

    if (!effectiveDate) {
      toast.error('Effective start date is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        salarySourceId: selectedSourceId,
        effectiveDate,
        annualCtc: ctcNum,
        baseSalary: baseSalary ? parseFloat(baseSalary) : undefined,
        monthlyInHand: monthlyInHand ? parseFloat(monthlyInHand) : undefined,
        variablePay: variablePay ? parseFloat(variablePay) : undefined,
        stockGrant: stockGrant ? parseFloat(stockGrant) : undefined,
        hikePercentage: hikePercentage ? parseFloat(hikePercentage) : undefined,
        hikeType,
        designation: designation.trim() || undefined,
        notes: notes.trim() || undefined,
      }

      if (isEditing) {
        await apiClient.fetch(`/v1/salary/revisions/${revisionToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Salary revision updated')
      } else {
        await apiClient.fetch('/v1/salary/revisions', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('New salary revision / hike recorded!')
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to record salary revision')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit Salary Hike / Revision' : 'Record Salary Hike (Mid-Year / Annual)'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Specify the effective start date for when this hike comes into place. Mid-year hike dates are fully supported.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Salary Source selection */}
            <div className="space-y-1.5">
              <Label htmlFor="salarySource" className="text-xs font-medium text-foreground">
                Salary Source / Employer <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedSourceId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedSourceId(val)
                    setHikePercentage('')
                  }
                }}
                disabled={isEditing}
              >
                <SelectTrigger id="salarySource" className="h-9 text-xs">
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  {salarySources.map((source) => (
                    <SelectItem key={source.id} value={source.id} className="text-xs">
                      {source.companyName} — {source.role} (Current: {formatINR(source.currentAnnualCtc)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Effective Start Date & Hike Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="effectiveDate" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Effective Start Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Hike % is recalculated date-wise based on the revision prior to this date.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hikeType" className="text-xs font-medium text-foreground">
                  Revision Reason
                </Label>
                <Select value={hikeType} onValueChange={(val) => { if (val) setHikeType(val); }}>
                  <SelectTrigger id="hikeType" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mid_year_hike" className="text-xs">
                      Mid-Year Hike
                    </SelectItem>
                    <SelectItem value="annual_review" className="text-xs">
                      Annual Appraisal
                    </SelectItem>
                    <SelectItem value="promotion" className="text-xs">
                      Promotion Increment
                    </SelectItem>
                    <SelectItem value="market_correction" className="text-xs">
                      Market Correction
                    </SelectItem>
                    <SelectItem value="retention" className="text-xs">
                      Retention Bump
                    </SelectItem>
                    <SelectItem value="joining" className="text-xs">
                      Joining / Initial
                    </SelectItem>
                    <SelectItem value="other" className="text-xs">
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Compensation Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="annualCtc" className="text-xs font-medium text-foreground">
                  New Annual CTC (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="annualCtc"
                  type="number"
                  placeholder="e.g. 2400000"
                  value={annualCtc}
                  onChange={(e) => handleCtcChange(e.target.value)}
                  className="h-9 text-xs font-mono font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hikePercentage" className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Hike Percentage (%)</span>
                  {priorRevision ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      Baseline: {formatINR(priorRevision.ctc)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Earliest revision (0%)
                    </span>
                  )}
                </Label>
                <Input
                  id="hikePercentage"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 15.5"
                  value={hikePercentage}
                  onChange={(e) => handleHikePctChange(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  {priorRevision
                    ? `Date-wise baseline: ${formatINR(priorRevision.ctc)} (${typeof priorRevision.effectiveDate === 'string' ? priorRevision.effectiveDate.split('T')[0] : new Date(priorRevision.effectiveDate).toISOString().split('T')[0]})`
                    : 'Starting compensation (no revision before this date)'}
                </p>
              </div>
            </div>

            {nextRevision && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Date-wise adjustment:</strong> A subsequent revision exists on {typeof nextRevision.effectiveDate === 'string' ? nextRevision.effectiveDate.split('T')[0] : new Date(nextRevision.effectiveDate).toISOString().split('T')[0]} ({formatINR(nextRevision.ctc)}). Its hike % will be automatically recalculated date-wise against this revision upon save.
                </span>
              </div>
            )}

            {/* Breakdown Components */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <Label htmlFor="monthlyInHand" className="text-[11px] font-medium text-foreground">
                  Monthly In-Hand (₹)
                </Label>
                <Input
                  id="monthlyInHand"
                  type="number"
                  placeholder="e.g. 150000"
                  value={monthlyInHand}
                  onChange={(e) => setMonthlyInHand(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="baseSalary" className="text-[11px] font-medium text-foreground">
                  Annual Base (₹)
                </Label>
                <Input
                  id="baseSalary"
                  type="number"
                  placeholder="Optional"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="variablePay" className="text-[11px] font-medium text-foreground">
                  Variable Bonus (₹)
                </Label>
                <Input
                  id="variablePay"
                  type="number"
                  placeholder="Optional"
                  value={variablePay}
                  onChange={(e) => setVariablePay(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* New Designation / Title */}
            <div className="space-y-1.5">
              <Label htmlFor="designation" className="text-xs font-medium text-foreground">
                Updated Role / Designation (if promoted)
              </Label>
              <Input
                id="designation"
                placeholder={selectedSource?.role || 'e.g. Lead Engineer'}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                Appraisal Notes / Milestones
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Exceeded targets on Q3 delivery, received out-of-turn mid-year increment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs resize-none h-16"
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
              {isEditing ? 'Save Changes' : 'Record Hike'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

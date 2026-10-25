'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/format'
import { AlertCircle, PlusCircle, RefreshCw, ArrowRight, Loader2, Info } from 'lucide-react'

export interface ExistingFYConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
    title?: string // e.g. "Calculated Salary" or "New Entry"
  }
  onAddToPresentFY: () => void | Promise<void>
  onOverwritePresentFY: () => void | Promise<void>
  isLoading?: boolean
}

export function ExistingFYConfirmDialog({
  open,
  onOpenChange,
  financialYear,
  existingData,
  newData,
  onAddToPresentFY,
  onOverwritePresentFY,
  isLoading = false,
}: ExistingFYConfirmDialogProps) {
  const existingGross = existingData.grossIncome || 0
  const existingNet = existingData.netIncome || 0

  const newGross = newData.grossIncome || 0
  const newNet = newData.netIncome || 0

  const combinedGross = existingGross + newGross
  const combinedNet = existingNet + newNet

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Data Already Exists for {financialYear}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {existingData.ownerName ? `For household member ${existingData.ownerName}. ` : ''}
                Avoid double entries by adding to the present FY instead.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Comparison Card */}
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Financial Year Income Comparison
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Column 1: Present FY */}
            <div className="p-3 rounded-lg bg-background border border-border/70 space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Present FY</span>
              <p className="text-base font-bold font-mono text-foreground">
                {formatINR(existingGross)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Net: {formatINR(existingNet)}
              </p>
            </div>

            {/* Column 2: New Amount */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
              <span className="text-[10px] font-semibold text-primary uppercase">
                {newData.title || 'Calculated Salary'}
              </span>
              <p className="text-base font-bold font-mono text-primary">
                +{formatINR(newGross)}
              </p>
              <p className="text-[10px] text-primary/80">
                Net: +{formatINR(newNet)}
              </p>
            </div>

            {/* Column 3: Combined Total */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                New Total (Added)
              </span>
              <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(combinedGross)}
              </p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                Net: {formatINR(combinedNet)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/50">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span>
              Adding to the present FY keeps all earnings for {financialYear} in one record, ensuring that YoY growth, CAGR, and charts calculate cleanly without duplicate entries.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-9"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1.5"
            onClick={onOverwritePresentFY}
            disabled={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Overwrite Present FY
          </Button>

          <Button
            type="button"
            size="sm"
            className="text-xs h-9 gap-1.5 shadow-xs"
            onClick={onAddToPresentFY}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlusCircle className="h-3.5 w-3.5" />
            )}
            Add to Present FY
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect } from 'react'
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
import { Loader2 } from 'lucide-react'

interface Owner {
  id: string
  name: string
  color: string
}

interface SalarySource {
  id: string
  ownerId?: string | null
  companyName: string
  role: string
  employmentType: string
  currency: string
  startDate: string | Date
  endDate?: string | Date | null
  status: string
  notes?: string | null
}

interface AddSalarySourceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceToEdit?: SalarySource | null
  owners: Owner[]
  onSuccess: () => void
}

export function AddSalarySourceModal({
  open,
  onOpenChange,
  sourceToEdit,
  owners,
  onSuccess,
}: AddSalarySourceModalProps) {
  const isEditing = !!sourceToEdit

  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [employmentType, setEmploymentType] = useState('full_time')
  const [status, setStatus] = useState<'active' | 'past'>('active')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]!)
  const [endDate, setEndDate] = useState('')
  const [ownerId, setOwnerId] = useState<string>('none')
  const [notes, setNotes] = useState('')

  // Initial joining compensation (only for new source)
  const [initialCtc, setInitialCtc] = useState('')
  const [initialBase, setInitialBase] = useState('')
  const [initialInHand, setInitialInHand] = useState('')
  const [initialVariable, setInitialVariable] = useState('')
  const [initialStock, setInitialStock] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (sourceToEdit) {
      setCompanyName(sourceToEdit.companyName)
      setRole(sourceToEdit.role)
      setEmploymentType(sourceToEdit.employmentType)
      setStatus(sourceToEdit.status as 'active' | 'past')
      setStartDate(
        typeof sourceToEdit.startDate === 'string'
          ? sourceToEdit.startDate.split('T')[0]!
          : new Date(sourceToEdit.startDate).toISOString().split('T')[0]!
      )
      setEndDate(
        sourceToEdit.endDate
          ? typeof sourceToEdit.endDate === 'string'
            ? sourceToEdit.endDate.split('T')[0]!
            : new Date(sourceToEdit.endDate).toISOString().split('T')[0]!
          : ''
      )
      setOwnerId(sourceToEdit.ownerId || 'none')
      setNotes(sourceToEdit.notes || '')
    } else {
      setCompanyName('')
      setRole('')
      setEmploymentType('full_time')
      setStatus('active')
      setStartDate(new Date().toISOString().split('T')[0]!)
      setEndDate('')
      setOwnerId(owners[0]?.id || 'none')
      setNotes('')
      setInitialCtc('')
      setInitialBase('')
      setInitialInHand('')
      setInitialVariable('')
      setInitialStock('')
    }
  }, [sourceToEdit, open, owners])

  // Auto-calculate monthly in-hand when initial CTC is entered
  const handleCtcChange = (val: string) => {
    setInitialCtc(val)
    const num = parseFloat(val) || 0
    if (num > 0 && !initialInHand) {
      setInitialInHand(String(Math.round(num / 12)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyName.trim()) {
      toast.error('Company or Source name is required')
      return
    }
    if (!role.trim()) {
      toast.error('Role or Designation is required')
      return
    }
    if (!startDate) {
      toast.error('Start date is required')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing) {
        await apiClient.fetch(`/v1/salary/sources/${sourceToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            companyName: companyName.trim(),
            role: role.trim(),
            employmentType,
            status,
            startDate,
            endDate: endDate.trim() ? endDate : null,
            ownerId: ownerId !== 'none' ? ownerId : null,
            notes: notes.trim() || null,
          }),
        })
        toast.success('Salary source updated')
      } else {
        const ctcNum = parseFloat(initialCtc)
        await apiClient.fetch('/v1/salary/sources', {
          method: 'POST',
          body: JSON.stringify({
            companyName: companyName.trim(),
            role: role.trim(),
            employmentType,
            status,
            startDate,
            endDate: endDate.trim() ? endDate : null,
            ownerId: ownerId !== 'none' ? ownerId : null,
            notes: notes.trim() || null,
            initialAnnualCtc: !isNaN(ctcNum) && ctcNum > 0 ? ctcNum : undefined,
            initialBaseSalary: initialBase ? parseFloat(initialBase) : undefined,
            initialMonthlyInHand: initialInHand ? parseFloat(initialInHand) : undefined,
            initialVariablePay: initialVariable ? parseFloat(initialVariable) : undefined,
            initialStockGrant: initialStock ? parseFloat(initialStock) : undefined,
          }),
        })
        toast.success('Salary source created with starting compensation')
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save salary source')
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
              {isEditing ? 'Edit Salary Source' : 'Add Salary Source / Employer'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Track compensation from jobs, contracts, or client engagements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-medium text-foreground">
                  Employer / Source Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  placeholder="e.g. Google, Acme Corp, Freelance"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs font-medium text-foreground">
                  Role / Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role"
                  placeholder="e.g. Senior Software Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="employmentType" className="text-xs font-medium text-foreground">
                  Type
                </Label>
                <Select value={employmentType} onValueChange={(val) => { if (val) setEmploymentType(val); }}>
                  <SelectTrigger id="employmentType" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time" className="text-xs">
                      Full-time
                    </SelectItem>
                    <SelectItem value="contract" className="text-xs">
                      Contract
                    </SelectItem>
                    <SelectItem value="freelance" className="text-xs">
                      Freelance
                    </SelectItem>
                    <SelectItem value="part_time" className="text-xs">
                      Part-time
                    </SelectItem>
                    <SelectItem value="internship" className="text-xs">
                      Internship
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium text-foreground">
                  Status
                </Label>
                <Select value={status} onValueChange={(val) => { if (val) setStatus(val as 'active' | 'past'); }}>
                  <SelectTrigger id="status" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">
                      Active (Current)
                    </SelectItem>
                    <SelectItem value="past" className="text-xs">
                      Past (Former)
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                        Default / Self
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs font-medium text-foreground">
                  Start Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium text-foreground">
                  End Date {status === 'past' && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Ongoing"
                />
              </div>
            </div>

            {/* Starting Compensation (for new source) */}
            {!isEditing && (
              <div className="border border-border/80 rounded-xl p-3.5 bg-muted/20 space-y-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Starting Compensation</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Your initial joining package. You can record subsequent mid-year and annual hikes anytime.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="initialCtc" className="text-xs font-medium text-foreground">
                      Annual CTC (₹) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="initialCtc"
                      type="number"
                      placeholder="e.g. 1800000"
                      value={initialCtc}
                      onChange={(e) => handleCtcChange(e.target.value)}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="initialInHand" className="text-xs font-medium text-foreground">
                      Monthly In-Hand (₹)
                    </Label>
                    <Input
                      id="initialInHand"
                      type="number"
                      placeholder="e.g. 125000"
                      value={initialInHand}
                      onChange={(e) => setInitialInHand(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Annual Base</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={initialBase}
                      onChange={(e) => setInitialBase(e.target.value)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Variable / Bonus</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={initialVariable}
                      onChange={(e) => setInitialVariable(e.target.value)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Stock / RSUs</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Remote work policy, annual review cycle in April"
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
              {isEditing ? 'Save Changes' : 'Create Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

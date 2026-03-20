'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface Liability {
  id: string
  userId: string
  name: string
  type: string
  outstandingAmount: string | number
  interestRate?: string | number | null
  monthlyPayment?: string | number | null
  createdAt: string
  updatedAt: string
}

const schema = z.object({
  type: z.enum(['credit_card', 'home_loan', 'auto_loan', 'personal_loan', 'student_loan', 'other']),
  name: z.string().min(1, 'Name is required'),
  outstandingAmount: z.number({ required_error: 'Amount is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  interestRate: z.union([z.number().nonnegative(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  monthlyPayment: z.union([z.number().nonnegative(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
})

type FormData = z.infer<typeof schema>

interface AddLiabilityModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  liability?: Liability
}

export function AddLiabilityModal({ open, onClose, onSave, liability }: AddLiabilityModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: (liability?.type as any) || 'credit_card',
      name: liability?.name || '',
      outstandingAmount: liability ? parseFloat(liability.outstandingAmount as any) : undefined,
      interestRate: liability?.interestRate ? parseFloat(liability.interestRate as any) : undefined,
      monthlyPayment: liability?.monthlyPayment ? parseFloat(liability.monthlyPayment as any) : undefined,
    },
  })

  const typeValue = watch('type')

  const onSubmit = async (data: FormData) => {
    await onSave(data, liability?.id)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{liability ? 'Edit Liability' : 'Add Liability'}</DialogTitle>
        </DialogHeader>

        <form id="liability-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Debt Type</Label>
              <Select value={typeValue} onValueChange={(val: any) => setValue('type', val)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="home_loan">Home Loan</SelectItem>
                  <SelectItem value="auto_loan">Auto Loan</SelectItem>
                  <SelectItem value="personal_loan">Personal Loan</SelectItem>
                  <SelectItem value="student_loan">Student Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name / Bank</Label>
              <Input id="name" placeholder="e.g. HDFC Credit Card" {...register('name')} />
              {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outstandingAmount">Outstanding Amount (₹)</Label>
            <Input id="outstandingAmount" type="number" step="0.01" placeholder="0.00" {...register('outstandingAmount', { valueAsNumber: true })} />
            {errors.outstandingAmount && <p className="text-xs text-rose-400">{errors.outstandingAmount.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (APR) <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="interestRate" type="number" step="0.01" placeholder="0.00" {...register('interestRate', { valueAsNumber: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyPayment">Monthly EMI/Payment <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="monthlyPayment" type="number" step="0.01" placeholder="0.00" {...register('monthlyPayment', { valueAsNumber: true })} />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="liability-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Liability'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

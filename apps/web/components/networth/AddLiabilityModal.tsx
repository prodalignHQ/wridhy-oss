'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  home_loan: 'Home Loan',
  car_loan: 'Car Loan',
  credit_card: 'Credit Card',
  student_loan: 'Student Loan',
  personal_loan: 'Personal Loan',
  other: 'Other',
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other']),
  outstandingAmount: z.coerce.number().nonnegative('Must be ≥ 0'),
  interestRate: z.coerce.number().nonnegative().optional().or(z.literal('')),
  monthlyPayment: z.coerce.number().nonnegative().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export interface Liability {
  id: string
  name: string
  type: string
  outstandingAmount: string
  interestRate?: string | null
  monthlyPayment?: string | null
  lastUpdated: string | Date
  createdAt: string
  userId: string
}

interface AddLiabilityModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData, id?: string) => Promise<void>
  liability?: Liability | null
  defaultType?: string
}

export function AddLiabilityModal({
  open,
  onClose,
  onSave,
  liability,
  defaultType,
}: AddLiabilityModalProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: liability
      ? {
          name: liability.name,
          type: liability.type as FormData['type'],
          outstandingAmount: parseFloat(liability.outstandingAmount),
          interestRate: liability.interestRate ? parseFloat(liability.interestRate) : undefined,
          monthlyPayment: liability.monthlyPayment
            ? parseFloat(liability.monthlyPayment)
            : undefined,
        }
      : {
          type: (defaultType as FormData['type']) ?? 'home_loan',
        },
  })

  const selectedType = watch('type')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSave(data, liability?.id)
      reset()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-50 max-w-md">
        <DialogHeader>
          <DialogTitle>{liability ? 'Edit Liability' : 'Add Liability'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">Name</Label>
            <Input
              {...register('name')}
              placeholder="e.g. Home Loan - SBI"
              className="bg-zinc-800 border-zinc-700 text-zinc-50"
            />
            {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">Type</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => setValue('type', v as FormData['type'])}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {Object.entries(LIABILITY_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-zinc-50 focus:bg-zinc-700">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outstanding Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">
              Outstanding Amount (₹)
            </Label>
            <Input
              {...register('outstandingAmount')}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-zinc-800 border-zinc-700 text-zinc-50 font-mono"
            />
            {errors.outstandingAmount && (
              <p className="text-xs text-rose-400">{errors.outstandingAmount.message}</p>
            )}
          </div>

          {/* Interest Rate (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">
              Interest Rate (% p.a.) — optional
            </Label>
            <Input
              {...register('interestRate')}
              type="number"
              step="0.01"
              placeholder="8.5"
              className="bg-zinc-800 border-zinc-700 text-zinc-50 font-mono"
            />
          </div>

          {/* Monthly Payment (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">
              Monthly Payment (₹) — optional
            </Label>
            <Input
              {...register('monthlyPayment')}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-zinc-800 border-zinc-700 text-zinc-50 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-50"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500">
              {loading ? 'Saving…' : liability ? 'Save Changes' : 'Add Liability'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

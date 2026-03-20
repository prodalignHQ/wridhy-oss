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
import { DepositAsset } from '../tables/DepositsTable'

const schema = z.object({
  type: z.enum(['fixed_deposit', 'recurring_deposit', 'ppf']),
  name: z.string().min(1, 'Name is required'),
  accountNumber: z.string().optional(),
  investedAmount: z.number({ required_error: 'Invested amount is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  presentAmount: z.number({ required_error: 'Present amount is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  interestRate: z.union([z.number().nonnegative(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  maturityDate: z.string().optional(),
  maturityAmount: z.union([z.number().nonnegative(), z.nan()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  comments: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface DepositModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: DepositAsset
}

export function DepositModal({ open, onClose, onSave, asset }: DepositModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: asset?.type || 'fixed_deposit',
      name: asset?.name || '',
      accountNumber: asset?.metadata?.accountNumber || '',
      investedAmount: asset?.metadata?.investedAmount || undefined,
      presentAmount: asset ? parseFloat(asset.value) : undefined,
      interestRate: asset?.metadata?.interestRate || undefined,
      maturityDate: asset?.metadata?.maturityDate ? new Date(asset.metadata.maturityDate).toISOString().split('T')[0] : '',
      maturityAmount: asset?.metadata?.maturityAmount || undefined,
      comments: asset?.metadata?.comments || '',
    },
  })

  const typeValue = watch('type')

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: data.type,
      value: data.presentAmount,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      metadata: {
        accountNumber: data.accountNumber || undefined,
        investedAmount: data.investedAmount,
        interestRate: data.interestRate,
        maturityDate: data.maturityDate ? new Date(data.maturityDate).toISOString() : undefined,
        maturityAmount: data.maturityAmount,
        comments: data.comments || undefined,
      }
    }

    await onSave(payload, asset?.id)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit Deposit' : 'Add Deposit / PPF'}</DialogTitle>
        </DialogHeader>

        <form id="deposit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Deposit Type</Label>
              <Select value={typeValue} onValueChange={(val: any) => setValue('type', val)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                  <SelectItem value="recurring_deposit">Recurring Deposit</SelectItem>
                  <SelectItem value="ppf">PPF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name / Bank</Label>
              <Input id="name" placeholder="e.g. HDFC 1Yr FD" {...register('name')} />
              {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="accountNumber" placeholder="e.g. 50100XXXX" {...register('accountNumber')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%) <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="interestRate" type="number" step="0.01" placeholder="7.10" {...register('interestRate', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
            <div className="space-y-2">
              <Label htmlFor="investedAmount">Invested Amount (₹)</Label>
              <Input id="investedAmount" type="number" step="0.01" placeholder="0.00" {...register('investedAmount', { valueAsNumber: true })} />
              {errors.investedAmount && <p className="text-xs text-rose-400">{errors.investedAmount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="presentAmount">Present Value (₹)</Label>
              <Input id="presentAmount" type="number" step="0.01" placeholder="0.00" {...register('presentAmount', { valueAsNumber: true })} />
              {errors.presentAmount && <p className="text-xs text-rose-400">{errors.presentAmount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maturityDate">Maturity Date <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="maturityDate" type="date" {...register('maturityDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maturityAmount">Maturity Amount (₹) <span className="text-zinc-500 font-normal">(Optional)</span></Label>
              <Input id="maturityAmount" type="number" step="0.01" placeholder="0.00" {...register('maturityAmount', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments <span className="text-zinc-500 font-normal">(Optional)</span></Label>
            <Input id="comments" placeholder="e.g. Locked in for 5 years" {...register('comments')} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="deposit-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Deposit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

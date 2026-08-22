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
import { SavingsAsset } from '../tables/SavingsTable'

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().optional(),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).optional().nullable(),
  currentBalance: z.number({ required_error: 'Balance is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  ownerId: z.string().uuid().optional(),
})

type FormData = z.infer<typeof schema>

interface SavingsModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: SavingsAsset
  owners?: Owner[]
  defaultOwnerId?: string
}

export function SavingsModal({ open, onClose, onSave, asset, owners, defaultOwnerId }: SavingsModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: asset?.name || '',
      accountNumber: asset?.metadata?.accountNumber || '',
      equityDebtTag: (asset?.equityDebtTag as any) || 'cash',
      currentBalance: asset ? parseFloat(asset.value) : undefined,
      ownerId: asset?.ownerId || defaultOwnerId || '',
    },
  })

  const equityDebtTagValue = watch('equityDebtTag')
  const ownerIdValue = watch('ownerId')

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: 'savings_account',
      value: data.currentBalance,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      equityDebtTag: data.equityDebtTag || 'cash',
      metadata: {
        accountNumber: data.accountNumber || undefined,
      },
      ownerId: data.ownerId || undefined,
    }

    await onSave(payload, asset?.id)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit Savings Account' : 'Add Savings Account'}</DialogTitle>
        </DialogHeader>

        <form id="savings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bank Name</Label>
            <Input id="name" placeholder="e.g. HDFC Bank" {...register('name')} />
            {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Input id="accountNumber" placeholder="e.g. 50100XXXX" {...register('accountNumber')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equityDebtTag">Asset Class Tag</Label>
            <Select value={equityDebtTagValue || 'cash'} onValueChange={(val: any) => setValue('equityDebtTag', val)}>
              <SelectTrigger id="equityDebtTag">
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="debt">Debt</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentBalance">Current Balance (₹)</Label>
            <Input id="currentBalance" type="number" step="0.01" placeholder="0.00" {...register('currentBalance', { valueAsNumber: true })} />
            {errors.currentBalance && <p className="text-xs text-rose-400">{errors.currentBalance.message}</p>}
          </div>

          {owners && owners.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner</Label>
              <Select value={ownerIdValue} onValueChange={(val: any) => setValue('ownerId', val)}>
                <SelectTrigger id="ownerId">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="savings-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

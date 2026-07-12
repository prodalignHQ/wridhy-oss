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
import { MutualFundAsset } from '../tables/MutualFundsTable'

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  folioNumber: z.string().optional(),
  category: z.enum(['Equity', 'Debt', 'Hybrid', 'Other']).optional(),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).optional().nullable(),
  investedAmount: z.number({ required_error: 'Invested amount is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  presentAmount: z.number({ required_error: 'Present amount is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  comments: z.string().optional(),
  ownerId: z.string().uuid().optional(),
})

type FormData = z.infer<typeof schema>

interface MutualFundModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: MutualFundAsset
  owners?: Owner[]
  defaultOwnerId?: string
}

export function MutualFundModal({ open, onClose, onSave, asset, owners, defaultOwnerId }: MutualFundModalProps) {
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
      folioNumber: asset?.metadata?.folioNumber || '',
      category: (asset?.metadata?.category as any) || 'Equity',
      equityDebtTag: (asset?.equityDebtTag as any) || null,
      investedAmount: asset?.metadata?.investedAmount || undefined,
      presentAmount: asset ? parseFloat(asset.value) : undefined,
      comments: asset?.metadata?.comments || '',
      ownerId: asset?.ownerId || defaultOwnerId || '',
    },
  })

  const categoryValue = watch('category')
  const equityDebtTagValue = watch('equityDebtTag')
  const ownerIdValue = watch('ownerId')

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: 'mutual_fund',
      value: data.presentAmount,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      equityDebtTag: data.equityDebtTag || undefined,
      metadata: {
        folioNumber: data.folioNumber || undefined,
        investedAmount: data.investedAmount,
        category: data.category,
        comments: data.comments || undefined,
      },
      ownerId: data.ownerId || undefined,
    }

    await onSave(payload, asset?.id)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit Mutual Fund' : 'Add Mutual Fund'}</DialogTitle>
        </DialogHeader>

        <form id="mf-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Fund Name</Label>
            <Input id="name" placeholder="e.g. Parag Parikh Flexi Cap" {...register('name')} />
            {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="folioNumber">Folio Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Input id="folioNumber" placeholder="e.g. 12345678" {...register('folioNumber')} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryValue} onValueChange={(val: any) => setValue('category', val)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Equity">Equity</SelectItem>
                  <SelectItem value="Debt">Debt</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equityDebtTag">Classification</Label>
            <Select value={equityDebtTagValue || '__none__'} onValueChange={(val: any) => setValue('equityDebtTag', val === '__none__' ? null : val)}>
              <SelectTrigger id="equityDebtTag">
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="debt">Debt</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label htmlFor="comments">Comments <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Input id="comments" placeholder="e.g. SIP of ₹5k/mo" {...register('comments')} />
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
          <Button type="submit" form="mf-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Fund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

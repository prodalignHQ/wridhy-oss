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
import { GenericAsset } from '../tables/GenericAssetTable'

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

const schema = z.object({
  type: z.enum(['real_estate', 'crypto', 'cash', 'other']),
  name: z.string().min(1, 'Name is required'),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).optional().nullable(),
  value: z.number({ required_error: 'Estimated value is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  comments: z.string().optional(),
  ownerId: z.string().uuid().optional(),
})

type FormData = z.infer<typeof schema>

interface GenericAssetModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: GenericAsset
  owners?: Owner[]
  defaultOwnerId?: string
}

export function GenericAssetModal({ open, onClose, onSave, asset, owners, defaultOwnerId }: GenericAssetModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: asset?.type || 'real_estate',
      name: asset?.name || '',
      equityDebtTag: (asset?.equityDebtTag as any) || (asset?.type === 'cash' ? 'cash' : 'equity'),
      value: asset ? parseFloat(asset.value) : undefined,
      comments: asset?.metadata?.comments || '',
      ownerId: asset?.ownerId || defaultOwnerId || '',
    },
  })

  const typeValue = watch('type')
  const equityDebtTagValue = watch('equityDebtTag')
  const ownerIdValue = watch('ownerId')

  const handleTypeChange = (val: 'real_estate' | 'crypto' | 'cash' | 'other' | null) => {
    if (!val) return
    setValue('type', val)
    if (val === 'cash') {
      setValue('equityDebtTag', 'cash')
    } else if (val === 'crypto' || val === 'real_estate') {
      setValue('equityDebtTag', 'equity')
    }
  }

  const onSubmit = async (data: FormData) => {
    const finalTag = data.equityDebtTag || (data.type === 'cash' ? 'cash' : 'equity')
    const payload = {
      name: data.name,
      type: data.type,
      value: data.value,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      equityDebtTag: finalTag,
      metadata: {
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
          <DialogTitle>{asset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
        </DialogHeader>

        <form id="generic-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Asset Group</Label>
              <Select value={typeValue} onValueChange={handleTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equityDebtTag">Asset Class Tag</Label>
              <Select value={equityDebtTagValue || 'equity'} onValueChange={(val: any) => setValue('equityDebtTag', val)}>
                <SelectTrigger id="equityDebtTag">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="debt">Debt</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Asset Name</Label>
            <Input id="name" placeholder="e.g. Home" {...register('name')} />
            {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Estimated Value (₹)</Label>
            <Input id="value" type="number" step="0.01" placeholder="0.00" {...register('value', { valueAsNumber: true })} />
            {errors.value && <p className="text-xs text-rose-400">{errors.value.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Input id="comments" placeholder="e.g. Ancestral Property" {...register('comments')} />
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
          <Button type="submit" form="generic-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Asset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

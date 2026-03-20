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

const schema = z.object({
  type: z.enum(['real_estate', 'crypto', 'cash', 'other']),
  name: z.string().min(1, 'Name is required'),
  value: z.number({ required_error: 'Estimated value is required', invalid_type_error: 'Must be a number' }).nonnegative('Must be positive'),
  comments: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface GenericAssetModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: GenericAsset
}

export function GenericAssetModal({ open, onClose, onSave, asset }: GenericAssetModalProps) {
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
      value: asset ? parseFloat(asset.value) : undefined,
      comments: asset?.metadata?.comments || '',
    },
  })

  const typeValue = watch('type')

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: data.type,
      value: data.value,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      metadata: {
        comments: data.comments || undefined,
      }
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
              <Select value={typeValue} onValueChange={(val: any) => setValue('type', val)}>
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
              <Label htmlFor="name">Asset Name</Label>
              <Input id="name" placeholder="e.g. Home" {...register('name')} />
              {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
            </div>
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

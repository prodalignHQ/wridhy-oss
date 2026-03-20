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

const ASSET_TYPE_LABELS: Record<string, string> = {
  bank_account: 'Bank Account',
  investment: 'Investment',
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other',
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['bank_account', 'investment', 'real_estate', 'crypto', 'cash', 'other']),
  value: z.coerce.number().nonnegative('Must be ≥ 0'),
  valuationDate: z.string().min(1, 'Date is required'),
  currency: z.string().default('INR'),
})

type FormData = z.infer<typeof schema>

export interface Asset {
  id: string
  name: string
  type: string
  value: string
  currency: string
  valuationDate: string | Date
  createdAt: string
  updatedAt: string
  userId: string
}

interface AddAssetModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData, id?: string) => Promise<void>
  asset?: Asset | null
  defaultType?: string
}

export function AddAssetModal({ open, onClose, onSave, asset, defaultType }: AddAssetModalProps) {
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
    defaultValues: asset
      ? {
          name: asset.name,
          type: asset.type as FormData['type'],
          value: parseFloat(asset.value),
          valuationDate: new Date(asset.valuationDate).toISOString().split('T')[0],
          currency: asset.currency,
        }
      : {
          type: (defaultType as FormData['type']) ?? 'bank_account',
          currency: 'INR',
          valuationDate: new Date().toISOString().split('T')[0],
        },
  })

  const selectedType = watch('type')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSave(data, asset?.id)
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
          <DialogTitle>{asset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">Name</Label>
            <Input
              {...register('name')}
              placeholder="e.g. HDFC Savings Account"
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
                {Object.entries(ASSET_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-zinc-50 focus:bg-zinc-700">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">Value (₹)</Label>
            <Input
              {...register('value')}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-zinc-800 border-zinc-700 text-zinc-50 font-mono"
            />
            {errors.value && <p className="text-xs text-rose-400">{errors.value.message}</p>}
          </div>

          {/* Valuation Date */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-zinc-400">Valuation Date</Label>
            <Input
              {...register('valuationDate')}
              type="date"
              className="bg-zinc-800 border-zinc-700 text-zinc-50"
            />
            {errors.valuationDate && (
              <p className="text-xs text-rose-400">{errors.valuationDate.message}</p>
            )}
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
              {loading ? 'Saving…' : asset ? 'Save Changes' : 'Add Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

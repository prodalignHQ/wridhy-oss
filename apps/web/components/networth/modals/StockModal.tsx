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
import { StockAsset } from '../tables/StocksTable'

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.number({ required_error: 'Qty required', invalid_type_error: 'Must be a number' }).nonnegative(),
  averageBuyPrice: z.number({ required_error: 'Avg price required', invalid_type_error: 'Must be a number' }).nonnegative(),
  ltp: z.number({ required_error: 'LTP required', invalid_type_error: 'Must be a number' }).nonnegative(),
  ownerId: z.string().uuid().optional(),
})

type FormData = z.infer<typeof schema>

interface StockModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: any, id?: string) => Promise<void>
  asset?: StockAsset
  owners?: Owner[]
  defaultOwnerId?: string
}

export function StockModal({ open, onClose, onSave, asset, owners, defaultOwnerId }: StockModalProps) {
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
      quantity: asset?.metadata?.quantity || undefined,
      averageBuyPrice: asset?.metadata?.averageBuyPrice || undefined,
      ltp: asset?.metadata?.ltp || undefined,
      ownerId: asset?.ownerId || defaultOwnerId || '',
    },
  })

  // Watch for dynamic calculation helpers below if needed
  const qty = watch('quantity')
  const avg = watch('averageBuyPrice')
  const ltpVal = watch('ltp')
  const ownerIdValue = watch('ownerId')

  const onSubmit = async (data: FormData) => {
    const investedAmount = data.quantity * data.averageBuyPrice
    const presentAmount = data.quantity * data.ltp

    const payload = {
      name: data.name,
      type: 'stock',
      value: presentAmount,
      currency: 'INR',
      valuationDate: new Date().toISOString(),
      metadata: {
        quantity: data.quantity,
        averageBuyPrice: data.averageBuyPrice,
        ltp: data.ltp,
        investedAmount,
      },
      ownerId: data.ownerId || undefined,
    }

    await onSave(payload, asset?.id)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit Stock' : 'Add Stock'}</DialogTitle>
        </DialogHeader>

        <form id="stock-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Stock Ticker / Name</Label>
            <Input id="name" placeholder="e.g. RELIANCE" {...register('name')} />
            {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" step="any" placeholder="0" {...register('quantity', { valueAsNumber: true })} />
              {errors.quantity && <p className="text-xs text-rose-400">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="averageBuyPrice">Avg Buy Price</Label>
              <Input id="averageBuyPrice" type="number" step="0.01" placeholder="₹0.00" {...register('averageBuyPrice', { valueAsNumber: true })} />
              {errors.averageBuyPrice && <p className="text-xs text-rose-400">{errors.averageBuyPrice.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ltp">LTP</Label>
              <Input id="ltp" type="number" step="0.01" placeholder="₹0.00" {...register('ltp', { valueAsNumber: true })} />
              {errors.ltp && <p className="text-xs text-rose-400">{errors.ltp.message}</p>}
            </div>
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

          <div className="pt-2">
            <div className="bg-card/50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2 border border-border">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Auto-Computed Invested</span>
                <span className="font-mono text-foreground/80">
                  ₹{((qty || 0) * (avg || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-muted-foreground text-xs">Auto-Computed Present Value</span>
                <span className="font-mono text-emerald-400">
                  ₹{((qty || 0) * (ltpVal || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="stock-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

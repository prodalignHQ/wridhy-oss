'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

export const BANKS = [
  { id: 'icici_savings', label: 'ICICI Bank — Savings Account', defaultType: 'bank' as const },
  { id: 'icici_credit', label: 'ICICI Bank — Credit Card', defaultType: 'credit_card' as const },
]

export const accountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['bank', 'credit_card', 'wallet', 'investment']),
  bankId: z.string().min(1, 'Please select a bank'),
  bankName: z.string().min(1, 'Bank name is required'),
  currency: z.string(),
})

export type AccountFormValues = z.infer<typeof accountSchema>

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (account: any) => void
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, watch, formState: { errors }, setValue, reset } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      accountName: '',
      accountType: 'bank',
      bankId: '',
      bankName: '',
      currency: 'INR'
    }
  })

  const watchedBankId = watch('bankId') ?? ''
  const watchedAccountType = watch('accountType') ?? 'bank'

  useEffect(() => {
    if (open) {
      reset({ accountName: '', accountType: 'bank', bankId: '', bankName: '', currency: 'INR' })
      setIsSubmitting(false)
    }
  }, [open, reset])

  const onSubmit = async (values: AccountFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await apiClient.fetch<any>('/v1/accounts', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      toast.success('Account created successfully')
      onOpenChange(false)
      reset()
      onSuccess?.(result)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Financial Account</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect a bank account or credit card to import statements and track transactions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Bank &amp; Statement Type</Label>
            <Select 
              value={watchedBankId} 
              onValueChange={(val) => {
                if (!val) return
                const bank = BANKS.find(b => b.id === val)
                setValue('bankId', val as any)
                if (bank) {
                  setValue('bankName', bank.label.replace(' — ', ' ') as any)
                  setValue('accountType', bank.defaultType)
                }
              }}
            >
              <SelectTrigger className="bg-background border-border focus:ring-primary">
                <SelectValue>
                  {BANKS.find(b => b.id === watchedBankId)?.label || 'Select bank and statement type'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {BANKS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bankId && <p className="text-rose-400 text-xs">{errors.bankId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Nickname</Label>
            <Input 
              id="accountName" 
              placeholder="e.g. Salary ICICI, Sapphiro Card" 
              className="bg-background border-border focus-visible:ring-primary" 
              {...register('accountName')} 
            />
            {errors.accountName && <p className="text-rose-400 text-xs">{errors.accountName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Account Classification</Label>
            <Select 
              value={watchedAccountType} 
              onValueChange={(val) => setValue('accountType', val as any)}
            >
              <SelectTrigger className="bg-background border-border focus:ring-primary">
                <SelectValue>
                  {watchedAccountType === 'bank' && 'Bank Account (Savings / Checking)'}
                  {watchedAccountType === 'credit_card' && 'Credit Card'}
                  {watchedAccountType === 'wallet' && 'Digital Wallet'}
                  {watchedAccountType === 'investment' && 'Investment Account'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="bank">Bank Account (Savings / Checking)</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="wallet">Digital Wallet</SelectItem>
                <SelectItem value="investment">Investment Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input 
              id="currency" 
              defaultValue="INR" 
              className="bg-background border-border focus-visible:ring-primary font-mono" 
              {...register('currency')} 
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-white" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                'Save Account'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

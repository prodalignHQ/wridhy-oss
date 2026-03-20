'use client'

import { useEffect, useState } from 'react'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Account {
  id: string
  accountName: string
  accountType: 'bank' | 'credit_card' | 'wallet' | 'investment'
  bankId: string
  bankName: string
  currency: string
}

const BANKS = [
  { id: 'icici_savings', label: 'ICICI Bank — Savings Account' },
  { id: 'icici_credit', label: 'ICICI Bank — Credit Card' },
]

const accountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['bank', 'credit_card', 'wallet', 'investment']),
  bankId: z.string().min(1, 'Please select a bank'),
  bankName: z.string().min(1, 'Bank name is required'),
  currency: z.string(),
})

type AccountFormValues = z.infer<typeof accountSchema>

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  
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

  // Watch form values for controlled selects
  const watchedBankId = watch('bankId') ?? ''
  const watchedAccountType = watch('accountType') ?? 'bank'

  // Reset form when dialog opens
  useEffect(() => {
    if (isAddOpen) {
      reset({ accountName: '', accountType: 'bank', bankId: '', bankName: '', currency: 'INR' })
    }
  }, [isAddOpen, reset])

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const data = await apiClient.fetch<Account[]>('/v1/accounts')
      setAccounts(data)
    } catch (err: any) {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const onSubmitAdd = async (values: AccountFormValues) => {
    try {
      await apiClient.fetch('/v1/accounts', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      toast.success('Account created successfully')
      setIsAddOpen(false)
      reset()
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account')
    }
  }

  const onDeleteConfirm = async () => {
    if (!accountToDelete) return
    try {
      await apiClient.fetch(`/v1/accounts/${accountToDelete}`, { method: 'DELETE' })
      toast.success('Account deleted')
      setAccounts(accounts.filter(a => a.id !== accountToDelete))
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account')
    } finally {
      setAccountToDelete(null)
    }
  }

  const formatType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
        <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Add Account
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-xl">
          <Landmark size={48} className="text-muted-foreground/70 mb-4" />
          <h2 className="text-lg font-semibold text-foreground/80 mb-2">No accounts yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add your first bank account, credit card, or wallet to start managing your transactions.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">
            Add Account
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} className="bg-card border-border rounded-xl p-5 relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold uppercase shrink-0">
                    {account.bankName.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground truncate max-w-[150px]" title={account.accountName}>
                      {account.accountName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{account.bankName}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setAccountToDelete(account.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Badge variant="secondary" className="bg-muted text-foreground/80 font-medium">
                  {formatType(account.accountType)}
                </Badge>
                <div className="text-sm font-mono text-muted-foreground font-medium">
                  {account.currency}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new financial account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Bank &amp; Statement Type</Label>
              <Select 
                value={watchedBankId} 
                onValueChange={(val) => {
                  if (!val) return
                  const bank = BANKS.find(b => b.id === val)
                  setValue('bankId', val as any)
                  if (bank) setValue('bankName', bank.label.replace(' — ', ' ') as any)
                }}
              >
                <SelectTrigger className="bg-background border-border focus:ring-indigo-500">
                  <SelectValue>
                    {BANKS.find(b => b.id === watchedBankId)?.label || 'Select bank and account type'}
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
              <Label htmlFor="accountName">Account Name</Label>
              <Input id="accountName" placeholder="e.g. Savings - 1234" className="bg-background border-border focus-visible:ring-indigo-500" {...register('accountName')} />
              {errors.accountName && <p className="text-rose-400 text-xs">{errors.accountName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select 
                value={watchedAccountType} 
                onValueChange={(val) => setValue('accountType', val as any)}
              >
                <SelectTrigger className="bg-background border-border focus:ring-indigo-500">
                  <SelectValue>
                    {watchedAccountType === 'bank' && 'Bank Account'}
                    {watchedAccountType === 'credit_card' && 'Credit Card'}
                    {watchedAccountType === 'wallet' && 'Digital Wallet'}
                    {watchedAccountType === 'investment' && 'Investment'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="wallet">Digital Wallet</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" defaultValue="INR" className="bg-background border-border focus-visible:ring-indigo-500 font-mono" {...register('currency')} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Save Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!accountToDelete} onOpenChange={() => setAccountToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this account. Related transactions will be orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-secondary hover:text-white border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} className="bg-rose-500 hover:bg-rose-600 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

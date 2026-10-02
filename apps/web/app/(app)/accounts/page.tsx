'use client'

import { useEffect, useState } from 'react'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog'
import { PageHelp } from '@/components/guide/PageHelp'

interface Account {
  id: string
  accountName: string
  accountType: 'bank' | 'credit_card' | 'wallet' | 'investment'
  bankId: string
  bankName: string
  currency: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { loadReferenceMerged } = await import('@/lib/engine/reference')
        const merged = await loadReferenceMerged('accounts', () =>
          apiClient.fetch<Account[]>('/v1/accounts')
        )
        setAccounts(merged as Account[])
        return
      }
      const data = await apiClient.fetch<Account[]>('/v1/accounts')
      setAccounts(data)
    } catch (err: any) {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const onDeleteConfirm = async () => {
    if (!accountToDelete) return
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { deleteReferenceRow } = await import('@/lib/engine/reference')
        const ok = await deleteReferenceRow('accounts', accountToDelete)
        if (!ok) throw new Error('Could not delete account on this device')
        toast.success('Account deleted')
        setAccounts(accounts.filter(a => a.id !== accountToDelete))
        return
      }
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
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
            <PageHelp section="accounts" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your connected bank accounts, credit cards, and digital wallets.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-medium">
          <Plus className="mr-2 h-4 w-4" /> Add Account
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading accounts...</div>
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
            <Card key={account.id} className="bg-card border-border rounded-xl p-5 relative group flex flex-col justify-between">
              <div>
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
                    className="text-muted-foreground hover:text-rose-400"
                    onClick={() => setAccountToDelete(account.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
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

      {/* Reusable Add Account Modal */}
      <AddAccountDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={fetchAccounts}
      />

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

'use client'

import { useEffect, useState, useRef } from 'react'
import { Search, Download, MoreHorizontal, ArrowLeftRight, ChevronLeft, ChevronRight, RefreshCw, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { OwnerAvatars } from '@/components/ui/custom/OwnerAvatars'
import { SplitOwnerModal } from '@/components/transactions/split-owner-modal'
import { CategoryPicker } from '@/components/transactions/category-picker'
import { useTransactionsStore, type Transaction, type Owner } from '@/lib/store/transactions.store'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-primary',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(String(value)))

// ─── Owner Filter Pill ─────────────────────────────────────────────────────────

function OwnerFilterPill({ owner, selected, onClick }: { owner: Owner; selected: boolean; onClick: () => void }) {
  const colorClass = COLOR_MAP[owner.color] ?? 'bg-muted'
  const initials = owner.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
        selected
          ? 'border-primary bg-secondary text-foreground ring-2 ring-primary/50'
          : 'border-border bg-muted text-muted-foreground hover:text-foreground/90'
      )}
    >
      <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold', colorClass)}>
        {initials}
      </span>
      {owner.name}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface FinancialAccount { id: string; accountName: string; bankName: string }

export default function TransactionsPage() {
  const {
    transactions, total, totalPages, isLoading, filters,
    setFilters, fetchTransactions, updateTransactionOwners, updateTransactionCategory, updateTransactionOneTime,
  } = useTransactionsStore()

  const [owners, setOwners] = useState<Owner[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null)
  const [reapplyLoading, setReapplyLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial data load
  useEffect(() => {
    fetchTransactions()
    apiClient.fetch<Owner[]>('/v1/owners').then(setOwners).catch(console.error)
    apiClient.fetch<FinancialAccount[]>('/v1/accounts').then(setAccounts).catch(console.error)
  }, [fetchTransactions])

  // Re-fetch when filters change
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions, filters])

  const handleSearch = (value: string) => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => setFilters({ search: value || undefined, page: 1 }), 300)
  }

  const handleCategoryUpdate = async (txnId: string, categoryId: string | null) => {
    try {
      await updateTransactionCategory(txnId, categoryId)
    } catch {
      toast.error('Failed to update category')
    }
  }

  const handleOwnerSave = async (ownerIds: string[]) => {
    if (!splitTarget) return
    try {
      await updateTransactionOwners(splitTarget.id, ownerIds)
      toast.success('Owners updated')
    } catch {
      toast.error('Failed to update owners')
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.accountId) params.set('accountId', filters.accountId)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.search) params.set('search', filters.search)
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    window.open(`${baseURL}/v1/transactions/export?${params.toString()}`, '_blank')
  }

  const handleReapplyRules = async () => {
    setReapplyLoading(true)
    try {
      const result = await apiClient.fetch<{ updatedCount: number }>('/v1/rules/reapply', {
        method: 'POST',
      })
      toast.success(`Updated ${result.updatedCount} transactions`)
      fetchTransactions()
    } catch (err) {
      console.error('Failed to reapply rules:', err)
      toast.error('Failed to reapply rules')
    } finally {
      setReapplyLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString('en-IN')} total</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border text-foreground/80 hover:text-foreground gap-2"
            onClick={handleReapplyRules}
            disabled={reapplyLoading}
          >
            {reapplyLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            <span className="hidden sm:inline">Re-apply Rules</span>
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground/80 hover:text-foreground gap-2"
            onClick={handleExport}
          >
            <Download size={15} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions…"
              className="pl-8 bg-muted border-border text-foreground/90 placeholder:text-muted-foreground"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Date range */}
          <Input
            type="date"
            className="w-auto bg-muted border-border text-foreground/80 text-sm"
            onChange={(e) => setFilters({ startDate: e.target.value || undefined, page: 1 })}
          />
          <Input
            type="date"
            className="w-auto bg-muted border-border text-foreground/80 text-sm"
            onChange={(e) => setFilters({ endDate: e.target.value || undefined, page: 1 })}
          />

          {/* Account filter */}
          <Select
            value={filters.accountId ?? 'all'}
            onValueChange={(v) => setFilters({ accountId: v === 'all' || v === null ? undefined : v, page: 1 })}
          >
            <SelectTrigger className="w-40 bg-muted border-border text-foreground/90 text-sm">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground/80 focus:bg-muted">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-foreground/90 focus:bg-muted">
                  {a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Owner filter pills */}
        {owners.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wide">Owner:</span>
            <button
              onClick={() => setFilters({ ownerId: undefined, page: 1 })}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                !filters.ownerId
                  ? 'border-primary bg-secondary text-foreground ring-2 ring-primary/50'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground/90'
              )}
            >
              All
            </button>
            {owners.map((owner) => (
              <OwnerFilterPill
                key={owner.id}
                owner={owner}
                selected={filters.ownerId === owner.id}
                onClick={() => setFilters({ ownerId: owner.id === filters.ownerId ? undefined : owner.id, page: 1 })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ArrowLeftRight size={26} className="text-muted-foreground/70" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground mb-1">No transactions found</p>
          <p className="text-xs text-muted-foreground/70">
            {Object.entries(filters).some(
              ([key, value]) => key !== 'page' && key !== 'limit' && Boolean(value)
            )
              ? 'Try adjusting your filters'
              : 'Upload a bank statement to get started'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">Date</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">Description</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium hidden lg:table-cell">Owners</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-muted/40 transition-colors h-11">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap text-xs">
                    {new Date(txn.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/90 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate block" title={txn.description}>
                        {txn.description.length > 60 ? txn.description.slice(0, 60) + '…' : txn.description}
                      </span>
                      {txn.isOneTime && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300 shrink-0">
                          <Zap size={9} />
                          One-Time
                        </span>
                      )}
                    </div>
                    {txn.comment && (
                      <span className="text-xs text-muted-foreground truncate block">{txn.comment}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <CategoryPicker
                      categoryId={txn.categoryId}
                      category={txn.category}
                      onUpdate={(categoryId) => handleCategoryUpdate(txn.id, categoryId)}
                    />
                  </td>
                  <td
                    className="px-4 py-2.5 cursor-pointer hidden lg:table-cell"
                    onClick={() => setSplitTarget(txn)}
                    title="Click to assign owners"
                  >
                    <OwnerAvatars
                      owners={txn.transactionOwners.map((to) => ({
                        id: to.ownerId,
                        name: to.owner.name,
                        color: to.owner.color,
                        isDefault: to.owner.isDefault,
                      }))}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                    <span className={txn.type === 'debit' ? 'text-rose-400' : 'text-emerald-400'}>
                      {txn.type === 'debit' ? '−' : '+'}{formatINR(txn.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground/90 transition-colors outline-none cursor-pointer">
                        <MoreHorizontal size={15} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border w-44">
                        <DropdownMenuItem
                          onClick={() => setSplitTarget(txn)}
                          className="text-foreground/80 focus:bg-muted focus:text-foreground"
                        >
                          Assign Owners
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await updateTransactionOneTime(txn.id, !txn.isOneTime)
                              toast.success(txn.isOneTime ? 'Marked as regular' : 'Marked as one-time')
                            } catch {
                              toast.error('Failed to update transaction')
                            }
                          }}
                          className="text-foreground/80 focus:bg-muted focus:text-foreground"
                        >
                          {txn.isOneTime ? 'Mark as Regular' : '⚡ Mark as One-Time'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {filters.page} of {totalPages} · {total.toLocaleString('en-IN')} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-foreground/80 h-8 px-2"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border text-foreground/80 h-8 px-2"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters({ page: filters.page + 1 })}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Split Owner Modal ── */}
      <SplitOwnerModal
        open={!!splitTarget}
        onClose={() => setSplitTarget(null)}
        transaction={splitTarget}
        owners={owners}
        onSave={handleOwnerSave}
      />
    </div>
  )
}

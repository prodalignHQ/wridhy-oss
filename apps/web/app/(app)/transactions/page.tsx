'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, Download, MoreHorizontal, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { OwnerAvatars } from '@/components/ui/custom/OwnerAvatars'
import { CategoryBadge } from '@/components/ui/custom/CategoryBadge'
import { SplitOwnerModal } from '@/components/transactions/split-owner-modal'
import { useTransactionsStore, type Transaction, type Owner } from '@/lib/store/transactions.store'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(String(value)))

// ─── Category Picker ──────────────────────────────────────────────────────────

interface Cat { id: string; name: string; color: string; icon: string | null; isSystem: boolean }

function CategoryPicker({ txn, onUpdate }: { txn: Transaction; onUpdate: (categoryId: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Cat[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open && categories.length === 0) {
      apiClient.fetch<Cat[]>('/v1/categories').then(setCategories).catch(console.error)
    }
  }, [open, categories.length])

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handle = async (cat: Cat | null) => {
    setOpen(false)
    await onUpdate(cat?.id ?? null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="cursor-pointer hover:opacity-80 transition-opacity">
        {txn.category ? (
          <CategoryBadge name={txn.category.name} color={txn.category.color} />
        ) : (
          <span className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">— Uncategorized</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-zinc-900 border-zinc-800" align="start">
        <Input
          placeholder="Search categories…"
          className="mb-2 h-8 bg-zinc-800 border-zinc-700 text-sm text-zinc-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          <button
            onClick={() => handle(null)}
            className="w-full text-left px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-800 rounded transition-colors"
          >
            — Uncategorized
          </button>
          {filtered.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handle(cat)}
              className={cn(
                'w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors',
                txn.categoryId === cat.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-zinc-600 px-2 py-2">No categories found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Owner Filter Pill ─────────────────────────────────────────────────────────

function OwnerFilterPill({ owner, selected, onClick }: { owner: Owner; selected: boolean; onClick: () => void }) {
  const colorClass = COLOR_MAP[owner.color] ?? 'bg-zinc-500'
  const initials = owner.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
        selected
          ? 'border-indigo-500 bg-zinc-700 text-zinc-100 ring-2 ring-indigo-500/50'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
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
    setFilters, fetchTransactions, updateTransactionOwners, updateTransactionCategory,
  } = useTransactionsStore()

  const [owners, setOwners] = useState<Owner[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial data load
  useEffect(() => {
    fetchTransactions()
    apiClient.fetch<Owner[]>('/v1/owners').then(setOwners).catch(console.error)
    apiClient.fetch<FinancialAccount[]>('/v1/accounts').then(setAccounts).catch(console.error)
  }, [])

  // Re-fetch when filters change
  useEffect(() => {
    fetchTransactions()
  }, [filters])

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

  const selectedOwner = owners.find((o) => o.id === filters.ownerId)

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Transactions</h1>
          {total > 0 && (
            <p className="text-sm text-zinc-500 mt-0.5">{total.toLocaleString('en-IN')} total</p>
          )}
        </div>
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:text-zinc-100 gap-2 hidden sm:flex"
          onClick={handleExport}
        >
          <Download size={15} />
          Export CSV
        </Button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search transactions…"
              className="pl-8 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Date range */}
          <Input
            type="date"
            className="w-auto bg-zinc-800 border-zinc-700 text-zinc-300 text-sm"
            onChange={(e) => setFilters({ startDate: e.target.value || undefined, page: 1 })}
          />
          <Input
            type="date"
            className="w-auto bg-zinc-800 border-zinc-700 text-zinc-300 text-sm"
            onChange={(e) => setFilters({ endDate: e.target.value || undefined, page: 1 })}
          />

          {/* Account filter */}
          <Select
            value={filters.accountId ?? 'all'}
            onValueChange={(v) => setFilters({ accountId: v === 'all' || v === null ? undefined : v, page: 1 })}
          >
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-zinc-200 text-sm">
              <SelectValue>
                {filters.accountId && filters.accountId !== 'all' 
                  ? accounts.find(a => a.id === filters.accountId)?.accountName 
                  : 'All Accounts'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-300 focus:bg-zinc-800">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-zinc-200 focus:bg-zinc-800">
                  {a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Owner filter pills */}
        {owners.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 uppercase tracking-wide">Owner:</span>
            <button
              onClick={() => setFilters({ ownerId: undefined, page: 1 })}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                !filters.ownerId
                  ? 'border-indigo-500 bg-zinc-700 text-zinc-100 ring-2 ring-indigo-500/50'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
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
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <ArrowLeftRight size={26} className="text-zinc-600" />
          </div>
          <p className="text-sm font-semibold text-zinc-400 mb-1">No transactions found</p>
          <p className="text-xs text-zinc-600">
            {Object.keys(filters).some((k) => k !== 'page' && k !== 'limit' && (filters as any)[k])
              ? 'Try adjusting your filters'
              : 'Upload a bank statement to get started'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 font-medium hidden lg:table-cell">Owners</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-zinc-800/40 transition-colors h-11">
                  <td className="px-4 py-2.5 text-zinc-500 tabular-nums whitespace-nowrap text-xs">
                    {new Date(txn.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-200 max-w-xs">
                    <span className="truncate block" title={txn.description}>
                      {txn.description.length > 60 ? txn.description.slice(0, 60) + '…' : txn.description}
                    </span>
                    {txn.comment && (
                      <span className="text-xs text-zinc-500 truncate block">{txn.comment}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <CategoryPicker
                      txn={txn}
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
                      <DropdownMenuTrigger className="w-7 h-7 rounded hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors outline-none cursor-pointer">
                        <MoreHorizontal size={15} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 w-40">
                        <DropdownMenuItem
                          onClick={() => setSplitTarget(txn)}
                          className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                        >
                          Assign Owners
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
          <p className="text-xs text-zinc-500">
            Page {filters.page} of {totalPages} · {total.toLocaleString('en-IN')} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 h-8 px-2"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 h-8 px-2"
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

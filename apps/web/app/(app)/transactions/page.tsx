'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  Search,
  Download,
  MoreHorizontal,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Zap,
  Filter,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OwnerAvatars } from '@/components/ui/custom/OwnerAvatars'
import { SplitOwnerModal } from '@/components/transactions/split-owner-modal'
import { CategoryPicker } from '@/components/transactions/category-picker'
import {
  useTransactionsStore,
  type Transaction,
  type Owner,
  type Category,
} from '@/lib/store/transactions.store'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    parseFloat(String(value))
  )

interface FinancialAccount {
  id: string
  accountName: string
  accountType?: string
  bankName: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const {
    transactions,
    total,
    totalPages,
    isLoading,
    filters,
    setFilters,
    fetchTransactions,
    updateTransactionOwners,
    updateTransactionCategory,
    updateTransactionOneTime,
    bulkUpdateOneTime,
    bulkUpdateCategory,
    bulkUpdateOwners,
  } = useTransactionsStore()

  const [owners, setOwners] = useState<Owner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const [ownerFilter, setOwnerFilter] = useState<string[]>([])

  // Selection & Bulk actions
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set())
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null)
  const [isBulkOwnerAssign, setIsBulkOwnerAssign] = useState(false)
  const [reapplyLoading, setReapplyLoading] = useState(false)

  // Prompts for bulk applying changes from a selected row
  const [pendingCategoryChange, setPendingCategoryChange] = useState<{
    transactionId: string
    categoryId: string | null
    selectedIds: string[]
  } | null>(null)
  const [applyingCategoryChange, setApplyingCategoryChange] = useState(false)

  const [pendingOwnerChange, setPendingOwnerChange] = useState<{
    transactionId: string
    ownerIds: string[]
    selectedIds: string[]
  } | null>(null)
  const [applyingOwnerChange, setApplyingOwnerChange] = useState(false)

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial data load
  useEffect(() => {
    fetchTransactions()
    apiClient.fetch<Owner[]>('/v1/owners').then(setOwners).catch(console.error)
    apiClient.fetch<Category[]>('/v1/categories').then(setCategories).catch(console.error)
    apiClient.fetch<FinancialAccount[]>('/v1/accounts').then(setAccounts).catch(console.error)
  }, [fetchTransactions])

  // Re-fetch when store filters change
  useEffect(() => {
    fetchTransactions()
    setSelectedTransactionIds(new Set())
  }, [fetchTransactions, filters])

  // Another device synced: vault pull restored OPFS → refetch this view.
  useEffect(() => {
    const onVaultUpdate = () => {
      fetchTransactions()
    }
    window.addEventListener('momoney:vault-updated', onVaultUpdate)
    return () => {
      window.removeEventListener('momoney:vault-updated', onVaultUpdate)
    }
  }, [fetchTransactions])

  // Sync ownerFilter array from filters.ownerId
  useEffect(() => {
    if (!filters.ownerId || filters.ownerId === 'all') {
      setOwnerFilter([])
    } else {
      setOwnerFilter(filters.ownerId.split(',').map((s) => s.trim()).filter(Boolean))
    }
  }, [filters.ownerId])

  // Search input debouncing
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setFilters({ search: value.trim() || undefined, page: 1 })
    }, 300)
  }

  // Owner options for assignee filter dropdown
  const ownerOptions = useMemo(() => {
    const sorted = [...owners]
      .map((o) => ({ value: o.id, label: o.name }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return [{ value: 'unassigned', label: 'Unassigned' }, ...sorted]
  }, [owners])

  const handleOwnerFilterToggle = (ownerId: string) => {
    const next = ownerFilter.includes(ownerId)
      ? ownerFilter.filter((id) => id !== ownerId)
      : [...ownerFilter, ownerId]
    setOwnerFilter(next)
    setFilters({
      ownerId: next.length === 0 ? undefined : next.join(','),
      page: 1,
    })
  }

  // Selection handlers
  const allSelected =
    transactions.length > 0 && transactions.every((t) => selectedTransactionIds.has(t.id))

  const toggleAllSelection = (checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)
      for (const t of transactions) {
        if (checked) next.add(t.id)
        else next.delete(t.id)
      }
      return next
    })
  }

  const toggleTransactionSelection = (id: string, checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Single row updates
  const handleToggleOneTime = async (txn: Transaction) => {
    try {
      await updateTransactionOneTime(txn.id, !txn.isOneTime)
      toast.success(txn.isOneTime ? 'Marked as regular' : 'Marked as one-time expense')
    } catch {
      toast.error('Failed to update transaction')
    }
  }

  const handleCategoryUpdate = async (txnId: string, categoryId: string | null) => {
    const selectedIds = Array.from(selectedTransactionIds)
    const shouldPrompt = selectedIds.length > 1 && selectedTransactionIds.has(txnId)

    if (shouldPrompt) {
      setPendingCategoryChange({
        transactionId: txnId,
        categoryId,
        selectedIds,
      })
      return
    }

    try {
      await updateTransactionCategory(txnId, categoryId)
      toast.success('Category updated')
    } catch {
      toast.error('Failed to update category')
    }
  }

  const handleOwnerSave = async (ownerIds: string[]) => {
    if (!splitTarget) return

    if (isBulkOwnerAssign) {
      const ids = Array.from(selectedTransactionIds)
      setIsBulkOwnerAssign(false)
      setSplitTarget(null)
      try {
        await bulkUpdateOwners(ids, ownerIds)
        toast.success(`Updated owners for ${ids.length} selected transactions`)
        setSelectedTransactionIds(new Set())
      } catch {
        toast.error('Failed to update owners')
      }
      return
    }

    const selectedIds = Array.from(selectedTransactionIds)
    const shouldPrompt = selectedIds.length > 1 && selectedTransactionIds.has(splitTarget.id)

    if (shouldPrompt) {
      setPendingOwnerChange({
        transactionId: splitTarget.id,
        ownerIds,
        selectedIds,
      })
      setSplitTarget(null)
      return
    }

    try {
      await updateTransactionOwners(splitTarget.id, ownerIds)
      toast.success('Owners updated')
      setSplitTarget(null)
    } catch {
      toast.error('Failed to update owners')
    }
  }

  // Bulk actions
  const handleBulkOneTime = async (isOneTime: boolean) => {
    const ids = Array.from(selectedTransactionIds)
    if (ids.length === 0) return

    try {
      await bulkUpdateOneTime(ids, isOneTime)
      toast.success(
        `Marked ${ids.length} transaction${ids.length === 1 ? '' : 's'} as ${
          isOneTime ? 'one-time' : 'regular'
        }`
      )
      setSelectedTransactionIds(new Set())
    } catch {
      toast.error('Failed to update transactions')
    }
  }

  // Bulk category modal actions
  const handleApplyCategoryToSelectedRows = async () => {
    if (!pendingCategoryChange) return
    setApplyingCategoryChange(true)
    try {
      await bulkUpdateCategory(pendingCategoryChange.selectedIds, pendingCategoryChange.categoryId)
      toast.success(
        `Updated category for ${pendingCategoryChange.selectedIds.length} selected transaction${
          pendingCategoryChange.selectedIds.length === 1 ? '' : 's'
        }`
      )
      setSelectedTransactionIds(new Set())
      setPendingCategoryChange(null)
    } catch {
      toast.error('Failed to update categories')
    } finally {
      setApplyingCategoryChange(false)
    }
  }

  const handleApplyCategoryOnlyThisRow = async () => {
    if (!pendingCategoryChange) return
    setApplyingCategoryChange(true)
    try {
      await updateTransactionCategory(
        pendingCategoryChange.transactionId,
        pendingCategoryChange.categoryId
      )
      toast.success('Updated category for this row')
      setPendingCategoryChange(null)
    } catch {
      toast.error('Failed to update category')
    } finally {
      setApplyingCategoryChange(false)
    }
  }

  // Bulk owner modal actions
  const handleApplyOwnersToSelectedRows = async () => {
    if (!pendingOwnerChange) return
    setApplyingOwnerChange(true)
    try {
      await bulkUpdateOwners(pendingOwnerChange.selectedIds, pendingOwnerChange.ownerIds)
      toast.success(
        `Updated owners for ${pendingOwnerChange.selectedIds.length} selected transaction${
          pendingOwnerChange.selectedIds.length === 1 ? '' : 's'
        }`
      )
      setSelectedTransactionIds(new Set())
      setPendingOwnerChange(null)
    } catch {
      toast.error('Failed to update owners')
    } finally {
      setApplyingOwnerChange(false)
    }
  }

  const handleApplyOwnersOnlyThisRow = async () => {
    if (!pendingOwnerChange) return
    setApplyingOwnerChange(true)
    try {
      await updateTransactionOwners(pendingOwnerChange.transactionId, pendingOwnerChange.ownerIds)
      toast.success('Updated owners for this row')
      setPendingOwnerChange(null)
    } catch {
      toast.error('Failed to update owners')
    } finally {
      setApplyingOwnerChange(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.accountId) params.set('accountId', filters.accountId)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.categoryId && filters.categoryId !== 'all') params.set('categoryId', filters.categoryId)
    if (filters.ownerId && filters.ownerId !== 'all') params.set('ownerId', filters.ownerId)
    if (filters.type && filters.type !== 'all') params.set('type', filters.type)
    if (filters.nature && filters.nature !== 'all') params.set('nature', filters.nature)
    if (filters.isOneTime !== undefined) params.set('isOneTime', String(filters.isOneTime))
    if (filters.search) params.set('search', filters.search)
    const baseURL = process.env.NEXT_PUBLIC_API_URL || ''
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

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.accountId ||
      filters.startDate ||
      filters.endDate ||
      (filters.categoryId && filters.categoryId !== 'all') ||
      (filters.ownerId && filters.ownerId !== 'all') ||
      (filters.type && filters.type !== 'all') ||
      (filters.nature && filters.nature !== 'all')
  )

  const handleClearFilters = () => {
    setSearchInput('')
    setOwnerFilter([])
    setFilters({
      search: undefined,
      accountId: undefined,
      startDate: undefined,
      endDate: undefined,
      categoryId: undefined,
      ownerId: undefined,
      type: undefined,
      nature: undefined,
      isOneTime: undefined,
      page: 1,
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total > 0
              ? `${total.toLocaleString('en-IN')} total transaction${total === 1 ? '' : 's'}`
              : 'Browse, filter, and organize your transactions.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border text-foreground/80 hover:text-foreground gap-2 text-xs h-9"
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
            className="border-border text-foreground/80 hover:text-foreground gap-2 text-xs h-9"
            onClick={handleExport}
          >
            <Download size={15} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        {/* Main filters matching Invoices */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-56 flex-1 sm:flex-initial">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Filter by description"
              className="border-border bg-background/80 pl-8 text-foreground text-xs h-9"
            />
          </div>

          {/* Nature filter (Regular, One-Time, Investments) */}
          <Select
            value={filters.nature ?? 'all'}
            onValueChange={(val) =>
              setFilters({
                nature: val === 'all' ? undefined : (val as 'regular' | 'one_time' | 'investment'),
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[170px] border-border bg-background/80 text-foreground/90 text-xs h-9">
              <SelectValue placeholder="Nature" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="regular">Regular spending</SelectItem>
              <SelectItem value="one_time">⚡ One-time only</SelectItem>
              <SelectItem value="investment">📈 Investments only</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select
            value={filters.categoryId ?? 'all'}
            onValueChange={(val) =>
              setFilters({
                categoryId: val === 'all' || !val ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[165px] border-border bg-background/80 text-foreground/90 text-xs h-9">
              <div className="flex items-center gap-2 truncate">
                <Filter size={13} className="text-muted-foreground shrink-0" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="uncategorized">— Uncategorized</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee / Owner filter (Multi-select dropdown matching Invoices) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="w-[160px] justify-start border-border bg-background/80 text-foreground/90 hover:bg-background hover:text-foreground text-xs h-9"
                >
                  <div className="flex items-center gap-2 truncate">
                    <User size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {ownerFilter.length === 0
                        ? 'All assignees'
                        : ownerFilter.length === 1
                          ? ownerOptions.find((o) => o.value === ownerFilter[0])?.label ?? '1 selected'
                          : `${ownerFilter.length} selected`}
                    </span>
                  </div>
                </Button>
              }
            />
            <DropdownMenuContent className="w-[170px] border-border bg-card">
              {ownerOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={ownerFilter.includes(option.value)}
                  onCheckedChange={() => handleOwnerFilterToggle(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type / Amounts filter (All, Debit, Credit) */}
          <Select
            value={filters.type ?? 'all'}
            onValueChange={(val) =>
              setFilters({
                type: val === 'all' ? undefined : (val as 'debit' | 'credit'),
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[140px] border-border bg-background/80 text-foreground/90 text-xs h-9">
              <SelectValue placeholder="All amounts" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">All amounts</SelectItem>
              <SelectItem value="debit">Debit only</SelectItem>
              <SelectItem value="credit">Credit only</SelectItem>
            </SelectContent>
          </Select>

          {/* Account filter */}
          <Select
            value={filters.accountId ?? 'all'}
            onValueChange={(v) =>
              setFilters({ accountId: v === 'all' || !v ? undefined : v, page: 1 })
            }
          >
            <SelectTrigger className="w-40 border-border bg-background/80 text-foreground/90 text-xs h-9">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Secondary row: Date range & clear filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/75">
              Dates:
            </span>
            <Input
              type="date"
              value={filters.startDate ?? ''}
              className="w-auto h-8 bg-background/70 border-border text-foreground/80 text-xs"
              onChange={(e) => setFilters({ startDate: e.target.value || undefined, page: 1 })}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={filters.endDate ?? ''}
              className="w-auto h-8 bg-background/70 border-border text-foreground/80 text-xs"
              onChange={(e) => setFilters({ endDate: e.target.value || undefined, page: 1 })}
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Banner ── */}
      {selectedTransactionIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 px-4 rounded-xl border border-primary/30 bg-primary/10 animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {selectedTransactionIds.size} transaction{selectedTransactionIds.size === 1 ? '' : 's'} selected
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setSelectedTransactionIds(new Set())}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBulkOneTime(true)}
              className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-xs"
            >
              <Zap size={13} />
              Mark One-Time
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBulkOneTime(false)}
              className="h-8 gap-1.5 border-border bg-card text-foreground/90 hover:bg-muted text-xs"
            >
              Mark Regular
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedList = transactions.filter((t) => selectedTransactionIds.has(t.id))
                const totalSelectedAmount = selectedList.reduce(
                  (sum, t) => sum + parseFloat(t.amount || '0'),
                  0
                )
                setIsBulkOwnerAssign(true)
                setSplitTarget({
                  id: 'bulk',
                  userId: '',
                  accountId: '',
                  statementId: null,
                  date: new Date().toISOString(),
                  description: `${selectedTransactionIds.size} selected transactions`,
                  merchant: null,
                  amount: String(totalSelectedAmount),
                  type: 'debit',
                  isOneTime: false,
                  categoryId: null,
                  comment: null,
                  dedupHash: '',
                  createdAt: '',
                  updatedAt: '',
                  category: null,
                  transactionOwners: [],
                })
              }}
              className="h-8 gap-1.5 border-border bg-card text-foreground/90 hover:bg-muted text-xs"
            >
              <User size={13} />
              Assign Owners
            </Button>
          </div>
        </div>
      )}

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
            {hasActiveFilters
              ? 'Try adjusting or clearing your filters'
              : 'Upload a bank statement to get started'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-x-auto bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/80 border-b border-border">
              <tr>
                <th className="sticky left-0 z-20 bg-card border-r border-border/50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAllSelection(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-card text-primary cursor-pointer"
                    aria-label="Select all transactions on page"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  One-Time?
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Owners
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Amount
                </th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {transactions.map((txn) => (
                <tr key={txn.id} className="group hover:bg-muted/30 transition-colors h-12">
                  {/* Row Checkbox */}
                  <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 border-r border-border/50 px-4 py-2.5 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedTransactionIds.has(txn.id)}
                      onChange={(e) => toggleTransactionSelection(txn.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border bg-card text-primary cursor-pointer"
                      aria-label={`Select transaction ${txn.description}`}
                    />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap text-xs">
                    {new Date(txn.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-2.5 text-foreground/90 max-w-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate block" title={txn.description}>
                        {txn.description}
                      </span>
                    </div>
                    {txn.comment && (
                      <span className="text-xs text-muted-foreground truncate block">{txn.comment}</span>
                    )}
                  </td>

                  {/* Category Picker */}
                  <td className="px-4 py-2.5">
                    <CategoryPicker
                      categoryId={txn.categoryId}
                      category={txn.category}
                      onUpdate={(categoryId) => handleCategoryUpdate(txn.id, categoryId)}
                    />
                  </td>

                  {/* One-Time Toggle (matching Invoices) */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void handleToggleOneTime(txn)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                        txn.isOneTime
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      )}
                      title="Click to toggle One-Time vs Regular"
                    >
                      {txn.isOneTime ? (
                        <>
                          <Zap size={12} className="text-amber-400" />
                          One-Time
                        </>
                      ) : (
                        'Regular'
                      )}
                    </button>
                  </td>

                  {/* Account Name */}
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden lg:table-cell whitespace-nowrap">
                    {txn.account?.accountName ?? '—'}
                  </td>

                  {/* Owners */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkOwnerAssign(false)
                        setSplitTarget(txn)
                      }}
                      className="rounded-lg transition-colors cursor-pointer hover:bg-muted/60 p-0.5"
                      title="Click to assign owners"
                    >
                      <OwnerAvatars
                        owners={txn.transactionOwners.map((to) => ({
                          name: to.owner.name,
                          color: to.owner.color,
                        }))}
                      />
                    </button>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                    <span
                      className={
                        txn.type === 'debit' ? 'text-rose-400' : 'text-emerald-400'
                      }
                    >
                      {txn.type === 'debit' ? '−' : '+'}
                      {formatINR(txn.amount)}
                    </span>
                  </td>

                  {/* Actions Dropdown */}
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground/90 transition-colors outline-none cursor-pointer"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="bg-card border-border w-44">
                        <DropdownMenuItem
                          onClick={() => {
                            setIsBulkOwnerAssign(false)
                            setSplitTarget(txn)
                          }}
                          className="text-foreground/80 focus:bg-muted focus:text-foreground"
                        >
                          Assign Owners
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleToggleOneTime(txn)}
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
        <div className="flex items-center justify-between pt-2">
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
        onClose={() => {
          setSplitTarget(null)
          setIsBulkOwnerAssign(false)
        }}
        transaction={splitTarget}
        owners={owners}
        onSave={handleOwnerSave}
      />

      {/* ── Bulk Category Confirmation Dialog (matching Invoices) ── */}
      <Dialog
        open={!!pendingCategoryChange}
        onOpenChange={(open) => {
          if (!open && !applyingCategoryChange) {
            setPendingCategoryChange(null)
          }
        }}
      >
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Apply category to selected rows?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {pendingCategoryChange
                ? `You have ${pendingCategoryChange.selectedIds.length} selected rows. Do you want to apply this category change to all of them?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-border bg-background/60">
            <Button
              variant="ghost"
              onClick={() => setPendingCategoryChange(null)}
              disabled={applyingCategoryChange}
              className="text-muted-foreground hover:bg-muted hover:text-foreground/90"
            >
              No
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleApplyCategoryOnlyThisRow()}
              disabled={applyingCategoryChange}
              className="border-border text-foreground/90 hover:bg-muted"
            >
              No, only this row
            </Button>
            <Button
              onClick={() => void handleApplyCategoryToSelectedRows()}
              disabled={applyingCategoryChange}
              className="bg-primary text-white hover:bg-primary"
            >
              {applyingCategoryChange ? 'Applying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Owner Confirmation Dialog (matching Invoices) ── */}
      <Dialog
        open={!!pendingOwnerChange}
        onOpenChange={(open) => {
          if (!open && !applyingOwnerChange) {
            setPendingOwnerChange(null)
          }
        }}
      >
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Apply owners to selected rows?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {pendingOwnerChange
                ? `You have ${pendingOwnerChange.selectedIds.length} selected rows. Do you want to apply this ownership change to all of them?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-border bg-background/60">
            <Button
              variant="ghost"
              onClick={() => setPendingOwnerChange(null)}
              disabled={applyingOwnerChange}
              className="text-muted-foreground hover:bg-muted hover:text-foreground/90"
            >
              No
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleApplyOwnersOnlyThisRow()}
              disabled={applyingOwnerChange}
              className="border-border text-foreground/90 hover:bg-muted"
            >
              No, only this row
            </Button>
            <Button
              onClick={() => void handleApplyOwnersToSelectedRows()}
              disabled={applyingOwnerChange}
              className="bg-primary text-white hover:bg-primary"
            >
              {applyingOwnerChange ? 'Applying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

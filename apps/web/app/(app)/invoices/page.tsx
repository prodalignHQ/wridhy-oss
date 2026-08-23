'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  FileText,
  Filter,
  Layers,
  Plus,
  Receipt,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CategoryBadge } from '@/components/ui/custom/CategoryBadge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { OwnerAvatars } from '@/components/ui/custom/OwnerAvatars'
import { SplitOwnerModal } from '@/components/transactions/split-owner-modal'
import { CategoryPicker } from '@/components/transactions/category-picker'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Statement {
  id: string
  statementMonth: string
  importedCount: number
  account: {
    accountName: string
    accountType: string
    bankName: string
  }
}

interface Owner {
  id: string
  name: string
  color: string
  isDefault?: boolean
}

interface InvoiceStatement {
  id: string
  statementId: string | null
  accountId: string | null
  statementMonth: string
  accountName: string
  accountType: string
}

interface InvoiceSummary {
  id: string
  name: string
  status: 'draft' | 'generated'
  invoiceMonth: string
  generatedAt: string | null
  createdAt: string
  updatedAt: string
  statements: InvoiceStatement[]
}

interface InvoiceOwnerShare {
  ownerId: string | null
  name: string
  color: string | null
  amount: string
  percentage: string
}

interface InvoiceTransaction {
  id: string
  statementId: string | null
  date: string
  description: string
  amount: string
  type: 'debit' | 'credit'
  isOneTime?: boolean
  categoryId: string | null
  category: {
    id: string | null
    name: string
    color: string | null
    type?: string | null
  } | null
  owners: InvoiceOwnerShare[]
}

interface InvoiceAnalysis {
  totalSpend?: number
  regularSpend?: number
  oneTimeSpend?: number
  totalInvestments?: number
  regularInvestments?: number
  oneTimeInvestments?: number
  totalOutflow?: number
  ownerTotals: Array<{
    ownerId: string | null
    name: string
    color: string | null
    total: number
    spendingTotal?: number
    regularSpendingTotal?: number
    oneTimeSpendingTotal?: number
    investmentTotal?: number
    regularInvestmentTotal?: number
    oneTimeInvestmentTotal?: number
  }>
  ownerCategoryTotals: Array<{
    ownerId: string | null
    name: string
    color: string | null
    total: number
    spendingTotal?: number
    regularSpendingTotal?: number
    oneTimeSpendingTotal?: number
    investmentTotal?: number
    regularInvestmentTotal?: number
    oneTimeInvestmentTotal?: number
    categories: Array<{
      categoryId: string | null
      category: string
      color?: string | null
      type?: string
      total: number
      regularTotal?: number
      oneTimeTotal?: number
    }>
  }>
  categoryTotals: Array<{
    categoryId: string | null
    category: string
    color: string | null
    type?: string
    total: number
    regularTotal?: number
    oneTimeTotal?: number
  }>
}

interface InvoiceDetail extends InvoiceSummary {
  transactions: InvoiceTransaction[]
  analysis: InvoiceAnalysis | null
}

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Math.abs(parseFloat(String(value)))
  )

const monthFromDate = (value: string) => value.slice(0, 7)

const formatMonth = (value: string) => {
  const month = monthFromDate(value)
  const [year, monthIndex] = month.split('-')
  const date = new Date(parseInt(year, 10), parseInt(monthIndex, 10) - 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })

function InvoiceListSection({
  title,
  invoices,
  activeInvoiceId,
  onSelect,
}: {
  title: string
  invoices: InvoiceSummary[]
  activeInvoiceId: string | null
  onSelect: (invoiceId: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground/70">{invoices.length}</span>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground/70">
          Nothing here yet.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => {
            const active = invoice.id === activeInvoiceId

            return (
              <button
                key={invoice.id}
                onClick={() => onSelect(invoice.id)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-border bg-card/50 hover:bg-card'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{invoice.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatMonth(invoice.invoiceMonth)}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      invoice.status === 'draft'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    )}
                  >
                    {invoice.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {invoice.statements.map((statement) => (
                    <span
                      key={statement.id}
                      className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {statement.accountName}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function InvoicesPage() {
  const searchParams = useSearchParams()
  const requestedMonth = searchParams.get('month')?.slice(0, 7) ?? ''

  const [statements, setStatements] = useState<Statement[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [activeInvoice, setActiveInvoice] = useState<InvoiceDetail | null>(null)
  const [composerOpen, setComposerOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [movingToDraft, setMovingToDraft] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(new Set())
  const [applyingCategoryChange, setApplyingCategoryChange] = useState(false)

  const toggleCategoryExpand = (ownerKey: string, categoryId: string | null, categoryName: string) => {
    const key = `${ownerKey}:${categoryId ?? 'uncategorized'}:${categoryName}`
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleOwnerCollapse = (ownerKey: string) => {
    setCollapsedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(ownerKey)) next.delete(ownerKey)
      else next.add(ownerKey)
      return next
    })
  }

  const [sortField, setSortField] = useState<'date' | 'amount' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [splitTarget, setSplitTarget] = useState<InvoiceTransaction | null>(null)
  const [pendingCategoryChange, setPendingCategoryChange] = useState<{
    transactionId: string
    categoryId: string | null
    selectedIds: string[]
  } | null>(null)
  const [pendingOwnerChange, setPendingOwnerChange] = useState<{
    transactionId: string
    ownerIds: string[]
    selectedIds: string[]
  } | null>(null)
  const [applyingOwnerChange, setApplyingOwnerChange] = useState(false)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set())

  const [newInvoiceName, setNewInvoiceName] = useState('')
  const [newInvoiceMonth, setNewInvoiceMonth] = useState('')
  const [newStatementIds, setNewStatementIds] = useState<string[]>([])

  const [draftName, setDraftName] = useState('')
  const [draftStatementIds, setDraftStatementIds] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [natureFilter, setNatureFilter] = useState<'all' | 'regular' | 'one_time' | 'investment'>('all')

  const drafts = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'draft'),
    [invoices]
  )
  const generatedInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'generated'),
    [invoices]
  )

  const newMonthStatements = useMemo(
    () =>
      statements.filter((statement) => monthFromDate(statement.statementMonth) === newInvoiceMonth),
    [newInvoiceMonth, statements]
  )

  const activeInvoiceMonth = monthFromDate(activeInvoice?.invoiceMonth ?? '')
  const activeInvoiceAvailableStatements = useMemo(
    () =>
      statements.filter((statement) => monthFromDate(statement.statementMonth) === activeInvoiceMonth),
    [activeInvoiceMonth, statements]
  )

  const statementLabels = useMemo(() => {
    return new Map(
      (activeInvoice?.statements ?? []).map((statement) => [
        statement.statementId,
        statement.accountName,
      ])
    )
  }, [activeInvoice])

  const categoryOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>()

    for (const transaction of activeInvoice?.transactions ?? []) {
      const value = transaction.categoryId ?? 'uncategorized'
      const label = transaction.category?.name ?? 'Uncategorized'
      options.set(value, { value, label })
    }

    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [activeInvoice])

  const ownerOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>([
      ['unassigned', { value: 'unassigned', label: 'Unassigned' }],
    ])

    for (const transaction of activeInvoice?.transactions ?? []) {
      if (transaction.owners.length === 0) {
        // Already handled by initial map entry
      } else {
        for (const owner of transaction.owners) {
          if (owner.ownerId) {
            options.set(owner.ownerId, { value: owner.ownerId, label: owner.name })
          }
        }
      }
    }

    const sorted = Array.from(options.values())
      .filter((o) => o.value !== 'unassigned')
      .sort((a, b) => a.label.localeCompare(b.label))

    return [{ value: 'unassigned', label: 'Unassigned' }, ...sorted]
  }, [activeInvoice])

  const filteredTransactions = useMemo(() => {
    const filtered = (activeInvoice?.transactions ?? []).filter((transaction) => {
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(search.trim().toLowerCase())
      const transactionCategory = transaction.categoryId ?? 'uncategorized'
      const matchesCategory = categoryFilter === 'all' || transactionCategory === categoryFilter
      const matchesType = typeFilter === 'all' || transaction.type === typeFilter
      const isInv = transaction.category?.type === 'investment'
      const isOneTime = Boolean(transaction.isOneTime)
      const matchesNature =
        natureFilter === 'all'
          ? true
          : natureFilter === 'investment'
          ? isInv
          : natureFilter === 'one_time'
          ? isOneTime && !isInv
          : !isOneTime && !isInv
      const matchesOwner =
        ownerFilter.length === 0 ||
        (ownerFilter.length === 1 && ownerFilter[0] === 'unassigned'
          ? transaction.owners.length === 0
          : transaction.owners.length === ownerFilter.length &&
          transaction.owners.every((o) => o.ownerId && ownerFilter.includes(o.ownerId)))

      return matchesSearch && matchesCategory && matchesType && matchesNature && matchesOwner
    })

    if (!sortField) {
      return filtered
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0
      if (sortField === 'amount') {
        const valA = parseFloat(a.amount)
        const valB = parseFloat(b.amount)
        comparison = valA - valB
      } else if (sortField === 'date') {
        const valA = new Date(a.date).getTime()
        const valB = new Date(b.date).getTime()
        comparison = valA - valB
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [activeInvoice, categoryFilter, search, typeFilter, ownerFilter, sortField, sortDirection])

  const filteredTransactionIds = useMemo(
    () => filteredTransactions.map((transaction) => transaction.id),
    [filteredTransactions]
  )

  const selectedFilteredCount = useMemo(
    () => filteredTransactionIds.filter((id) => selectedTransactionIds.has(id)).length,
    [filteredTransactionIds, selectedTransactionIds]
  )

  const filteredTotal = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const amount = parseFloat(t.amount)
      const signedAmount = t.type === 'debit' ? -amount : amount
      return acc + signedAmount
    }, 0)
  }, [filteredTransactions])

  const filteredAverage = useMemo(() => {
    if (filteredTransactions.length === 0) return 0
    return filteredTotal / filteredTransactions.length
  }, [filteredTotal, filteredTransactions])

  const allFilteredSelected =
    filteredTransactionIds.length > 0 && selectedFilteredCount === filteredTransactionIds.length

  const draftHasChanges = useMemo(() => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return false

    const originalIds = (activeInvoice.statements ?? [])
      .map((statement) => statement.statementId)
      .filter((statementId): statementId is string => Boolean(statementId))
      .sort()

    const nextIds = [...draftStatementIds].sort()

    return draftName.trim() !== activeInvoice.name || originalIds.join('|') !== nextIds.join('|')
  }, [activeInvoice, draftName, draftStatementIds])

  const loadInvoiceDetail = useCallback(async (invoiceId: string, backgroundRefresh = false) => {
    if (!backgroundRefresh) {
      setDetailLoading(true)
    }

    try {
      const detail = await apiClient.fetch<InvoiceDetail>(`/v1/invoices/${invoiceId}`)
      setActiveInvoice(detail)
      setSelectedTransactionIds(new Set())
      setPendingCategoryChange(null)

      if (detail.status === 'draft') {
        setDraftName(detail.name)
        setDraftStatementIds(
          detail.statements
            .map((statement) => statement.statementId)
            .filter((statementId): statementId is string => Boolean(statementId))
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load invoice')
    } finally {
      if (!backgroundRefresh) {
        setDetailLoading(false)
      }
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoading(true)

    try {
      const [invoiceList, statementList, ownerList] = await Promise.all([
        apiClient.fetch<InvoiceSummary[]>('/v1/invoices'),
        apiClient.fetch<Statement[]>('/v1/statements'),
        apiClient.fetch<Owner[]>('/v1/owners'),
      ])

      setInvoices(invoiceList)
      setStatements(statementList)
      setOwners(ownerList)

      const fallbackMonth =
        requestedMonth && statementList.some((statement) => monthFromDate(statement.statementMonth) === requestedMonth)
          ? requestedMonth
          : statementList.length > 0
            ? monthFromDate(
              [...statementList]
                .sort((a, b) => b.statementMonth.localeCompare(a.statementMonth))[0]!.statementMonth
            )
            : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

      setNewInvoiceMonth(fallbackMonth)
      setNewInvoiceName(
        fallbackMonth ? `${formatMonth(fallbackMonth)} household invoice` : 'New invoice'
      )

      if (requestedMonth) {
        setComposerOpen(true)
        setActiveInvoiceId(null)
        setActiveInvoice(null)
        return
      }

      if (invoiceList.length === 0) {
        setComposerOpen(true)
        setActiveInvoiceId(null)
        setActiveInvoice(null)
        return
      }

      const preferredInvoice = invoiceList.find((invoice) => invoice.status === 'draft') ?? invoiceList[0]
      setComposerOpen(false)
      setActiveInvoiceId(preferredInvoice.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [requestedMonth])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    if (!composerOpen) return

    setNewStatementIds(newMonthStatements.map((statement) => statement.id))
  }, [composerOpen, newMonthStatements])

  useEffect(() => {
    if (!activeInvoiceId || composerOpen) return
    void loadInvoiceDetail(activeInvoiceId)
  }, [activeInvoiceId, composerOpen, loadInvoiceDetail])

  const refreshInvoiceList = useCallback(
    async (nextActiveInvoiceId?: string | null) => {
      const invoiceList = await apiClient.fetch<InvoiceSummary[]>('/v1/invoices')
      setInvoices(invoiceList)

      if (nextActiveInvoiceId === null) {
        setActiveInvoiceId(null)
        setActiveInvoice(null)
        return null
      }

      const resolvedId =
        nextActiveInvoiceId ??
        (activeInvoiceId && invoiceList.some((invoice) => invoice.id === activeInvoiceId)
          ? activeInvoiceId
          : invoiceList.find((invoice) => invoice.status === 'draft')?.id ?? invoiceList[0]?.id ?? null)

      setActiveInvoiceId(resolvedId)
      if (!resolvedId) {
        setActiveInvoice(null)
      }

      return resolvedId
    },
    [activeInvoiceId]
  )

  const handleCreateInvoice = async () => {
    if (!newInvoiceName.trim()) {
      toast.error('Please name the invoice')
      return
    }

    if (newStatementIds.length === 0) {
      toast.error('Select at least one statement')
      return
    }

    setCreating(true)

    try {
      const created = await apiClient.fetch<InvoiceSummary>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          name: newInvoiceName.trim(),
          invoiceMonth: newInvoiceMonth,
          statementIds: newStatementIds,
        }),
      })

      toast.success('Draft invoice created')
      await refreshInvoiceList(created.id)
      setComposerOpen(false)
      setActiveInvoiceId(created.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return

    setSavingDraft(true)

    try {
      await apiClient.fetch<InvoiceSummary>(`/v1/invoices/${activeInvoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draftName.trim(),
          statementIds: draftStatementIds,
        }),
      })

      toast.success('Draft saved')
      await refreshInvoiceList(activeInvoice.id)
      await loadInvoiceDetail(activeInvoice.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return

    setGenerating(true)

    try {
      await apiClient.fetch<InvoiceSummary>(`/v1/invoices/${activeInvoice.id}/generate`, {
        method: 'POST',
      })

      toast.success('Invoice generated')
      await refreshInvoiceList(activeInvoice.id)
      await loadInvoiceDetail(activeInvoice.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  const handleMoveToDraft = async () => {
    if (!activeInvoice || activeInvoice.status !== 'generated') return

    setMovingToDraft(true)

    try {
      await apiClient.fetch<InvoiceSummary>(`/v1/invoices/${activeInvoice.id}/draft`, {
        method: 'POST',
      })

      toast.success('Invoice moved back to draft')
      await refreshInvoiceList(activeInvoice.id)
      await loadInvoiceDetail(activeInvoice.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to move invoice to draft')
    } finally {
      setMovingToDraft(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!activeInvoice) return

    setDeletingInvoice(true)

    try {
      await apiClient.fetch(`/v1/invoices/${activeInvoice.id}`, {
        method: 'DELETE',
      })

      toast.success('Invoice deleted')
      const nextInvoiceId = await refreshInvoiceList()

      if (nextInvoiceId) {
        setComposerOpen(false)
      } else {
        setComposerOpen(true)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete invoice')
    } finally {
      setDeletingInvoice(false)
    }
  }

  const applyOwnerChange = useCallback(
    async (transactionIds: string[], ownerIds: string[]) => {
      if (!activeInvoice || activeInvoice.status !== 'draft' || transactionIds.length === 0) {
        return
      }

      if (transactionIds.length === 1) {
        await apiClient.fetch(`/v1/transactions/${transactionIds[0]}/owners`, {
          method: 'PUT',
          body: JSON.stringify({ ownerIds }),
        })
      } else {
        await apiClient.fetch('/v1/transactions/bulk/owners', {
          method: 'PATCH',
          body: JSON.stringify({ transactionIds, ownerIds }),
        })
      }

      await loadInvoiceDetail(activeInvoice.id, true)
    },
    [activeInvoice, loadInvoiceDetail]
  )

  const handleOwnerSave = async (ownerIds: string[]) => {
    if (!splitTarget || !activeInvoice || activeInvoice.status !== 'draft') return

    try {
      const selectedIds = filteredTransactionIds.filter((id) => selectedTransactionIds.has(id))
      const shouldPrompt = selectedIds.length > 1 && selectedTransactionIds.has(splitTarget.id)

      if (shouldPrompt) {
        setPendingOwnerChange({
          transactionId: splitTarget.id,
          ownerIds,
          selectedIds,
        })
        return
      }

      await applyOwnerChange([splitTarget.id], ownerIds)
      toast.success('Owners updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update owners')
    }
  }

  const applyCategoryChange = useCallback(
    async (transactionIds: string[], categoryId: string | null) => {
      if (!activeInvoice || activeInvoice.status !== 'draft' || transactionIds.length === 0) {
        return
      }

      if (transactionIds.length === 1) {
        await apiClient.fetch(`/v1/transactions/${transactionIds[0]}`, {
          method: 'PATCH',
          body: JSON.stringify({ categoryId }),
        })
      } else {
        await apiClient.fetch('/v1/transactions/bulk/category', {
          method: 'PATCH',
          body: JSON.stringify({ transactionIds, categoryId }),
        })
      }

      await loadInvoiceDetail(activeInvoice.id, true)
    },
    [activeInvoice, loadInvoiceDetail]
  )

  const applyOneTimeChange = useCallback(
    async (transactionIds: string[], isOneTime: boolean) => {
      if (!activeInvoice || activeInvoice.status !== 'draft' || transactionIds.length === 0) {
        return
      }

      if (transactionIds.length === 1) {
        await apiClient.fetch(`/v1/transactions/${transactionIds[0]}`, {
          method: 'PATCH',
          body: JSON.stringify({ isOneTime }),
        })
      } else {
        await apiClient.fetch('/v1/transactions/bulk/one-time', {
          method: 'PATCH',
          body: JSON.stringify({ transactionIds, isOneTime }),
        })
      }

      await loadInvoiceDetail(activeInvoice.id, true)
    },
    [activeInvoice, loadInvoiceDetail]
  )

  const handleToggleOneTime = async (transaction: InvoiceTransaction) => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return
    try {
      await applyOneTimeChange([transaction.id], !transaction.isOneTime)
      toast.success(transaction.isOneTime ? 'Marked as regular' : 'Marked as one-time expense')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update transaction')
    }
  }

  const handleBulkOneTime = async (isOneTime: boolean) => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return
    const selectedIds = filteredTransactionIds.filter((id) => selectedTransactionIds.has(id))
    if (selectedIds.length === 0) return

    try {
      await applyOneTimeChange(selectedIds, isOneTime)
      toast.success(
        `Marked ${selectedIds.length} transaction${selectedIds.length === 1 ? '' : 's'} as ${isOneTime ? 'one-time' : 'regular'}`
      )
      setSelectedTransactionIds(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update transactions')
    }
  }

  const handleCategoryUpdate = async (transactionId: string, categoryId: string | null) => {
    if (!activeInvoice || activeInvoice.status !== 'draft') return

    try {
      const selectedIds = filteredTransactionIds.filter((id) => selectedTransactionIds.has(id))
      const shouldPrompt = selectedIds.length > 1 && selectedTransactionIds.has(transactionId)

      if (shouldPrompt) {
        setPendingCategoryChange({
          transactionId,
          categoryId,
          selectedIds,
        })
        return
      }

      await applyCategoryChange([transactionId], categoryId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    }
  }

  const toggleFilteredSelection = (checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)

      for (const transactionId of filteredTransactionIds) {
        if (checked) next.add(transactionId)
        else next.delete(transactionId)
      }

      return next
    })
  }

  const toggleTransactionSelection = (transactionId: string, checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(transactionId)
      else next.delete(transactionId)
      return next
    })
  }

  const handleApplyToSelectedRows = async () => {
    if (!pendingCategoryChange) return

    setApplyingCategoryChange(true)

    try {
      await applyCategoryChange(pendingCategoryChange.selectedIds, pendingCategoryChange.categoryId)
      toast.success(
        `Updated category for ${pendingCategoryChange.selectedIds.length} selected transaction${pendingCategoryChange.selectedIds.length === 1 ? '' : 's'
        }`
      )
      setPendingCategoryChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update categories')
    } finally {
      setApplyingCategoryChange(false)
    }
  }

  const handleApplyOnlyThisRow = async () => {
    if (!pendingCategoryChange) return

    setApplyingCategoryChange(true)

    try {
      await applyCategoryChange([pendingCategoryChange.transactionId], pendingCategoryChange.categoryId)
      toast.success('Updated category for this row')
      setPendingCategoryChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    } finally {
      setApplyingCategoryChange(false)
    }
  }

  const handleApplyOwnersToSelectedRows = async () => {
    if (!pendingOwnerChange) return

    setApplyingOwnerChange(true)

    try {
      await applyOwnerChange(pendingOwnerChange.selectedIds, pendingOwnerChange.ownerIds)
      toast.success(
        `Updated owners for ${pendingOwnerChange.selectedIds.length} selected transaction${pendingOwnerChange.selectedIds.length === 1 ? '' : 's'
        }`
      )
      setPendingOwnerChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update owners')
    } finally {
      setApplyingOwnerChange(false)
    }
  }

  const handleApplyOwnersOnlyThisRow = async () => {
    if (!pendingOwnerChange) return

    setApplyingOwnerChange(true)

    try {
      await applyOwnerChange([pendingOwnerChange.transactionId], pendingOwnerChange.ownerIds)
      toast.success('Updated owners for this row')
      setPendingOwnerChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update owners')
    } finally {
      setApplyingOwnerChange(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build invoice drafts from monthly statements, then generate a stored snapshot.
          </p>
        </div>
        <Button
          onClick={() => {
            setComposerOpen(true)
            setActiveInvoiceId(null)
            setActiveInvoice(null)
          }}
          className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
        >
          <Plus size={16} />
          Create Invoice
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5 rounded-2xl border border-border bg-card/40 p-4">
          <InvoiceListSection
            title="Drafts"
            invoices={drafts}
            activeInvoiceId={composerOpen ? null : activeInvoiceId}
            onSelect={(invoiceId) => {
              setComposerOpen(false)
              setActiveInvoiceId(invoiceId)
            }}
          />
          <InvoiceListSection
            title="Generated"
            invoices={generatedInvoices}
            activeInvoiceId={composerOpen ? null : activeInvoiceId}
            onSelect={(invoiceId) => {
              setComposerOpen(false)
              setActiveInvoiceId(invoiceId)
            }}
          />
        </aside>

        <section className="space-y-6">
          {composerOpen ? (
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                  <Receipt size={22} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">Create invoice draft</h2>
                  <p className="text-sm text-muted-foreground">
                    Pick a tagged month, select the statements to include, and start editing the
                    invoice before you generate it.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Invoice Name
                    </label>
                    <Input
                      value={newInvoiceName}
                      onChange={(e) => setNewInvoiceName(e.target.value)}
                      className="border-border bg-background text-foreground"
                      placeholder="March 2026 household invoice"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Invoice Month
                    </label>
                    <Input
                      type="month"
                      value={newInvoiceMonth}
                      onChange={(e) => setNewInvoiceMonth(e.target.value)}
                      className="border-border bg-background text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Statements For {newInvoiceMonth ? formatMonth(newInvoiceMonth) : 'This Month'}
                      </label>
                      <span className="text-xs text-muted-foreground/70">
                        {newStatementIds.length} selected
                      </span>
                    </div>

                    {newMonthStatements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground/70">
                        Upload and tag statements for this month first.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {newMonthStatements.map((statement) => {
                          const checked = newStatementIds.includes(statement.id)

                          return (
                            <label
                              key={statement.id}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                                checked
                                  ? 'border-indigo-500/50 bg-indigo-500/10'
                                  : 'border-border bg-background/70 hover:bg-card'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setNewStatementIds((prev) =>
                                    e.target.checked
                                      ? [...prev, statement.id]
                                      : prev.filter((value) => value !== statement.id)
                                  )
                                }}
                                className="mt-1 h-4 w-4 rounded border-border bg-card text-indigo-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {statement.account.accountName}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {statement.account.bankName} · {statement.importedCount} transactions
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    What happens next
                  </p>
                  <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground/90">1. Draft is created</p>
                      <p className="mt-1">
                        The draft appears in the Drafts section so you can come back to it anytime.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground/90">2. Edit transactions</p>
                      <p className="mt-1">
                        Categorize rows, assign owners, and filter down by description, category, or
                        debit versus credit.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground/90">3. Generate snapshot</p>
                      <p className="mt-1">
                        Generation stores a copy of the invoice data so the analysis stays stable.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleCreateInvoice()}
                    disabled={creating || !newInvoiceName.trim() || newStatementIds.length === 0}
                    className="mt-6 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                  >
                    <Plus size={16} />
                    {creating ? 'Creating Draft...' : 'Create Invoice'}
                  </Button>
                </div>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card/40">
              <div className="text-muted-foreground">Loading invoice...</div>
            </div>
          ) : !activeInvoice ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card/40">
              <div className="text-muted-foreground">Select an invoice to continue.</div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    {activeInvoice.status === 'draft' ? (
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-11 max-w-xl border-border bg-background text-xl font-semibold text-foreground"
                      />
                    ) : (
                      <div>
                        <h2 className="text-2xl font-semibold text-foreground">{activeInvoice.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Generated on{' '}
                          {activeInvoice.generatedAt
                            ? new Date(activeInvoice.generatedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                            : '—'}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground/80">
                        {formatMonth(activeInvoice.invoiceMonth)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                          activeInvoice.status === 'draft'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        )}
                      >
                        {activeInvoice.status}
                      </span>
                    </div>
                  </div>

                  {activeInvoice.status === 'draft' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={deletingInvoice}
                        className="gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <Trash2 size={15} />
                        Delete Invoice
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleSaveDraft()}
                        disabled={savingDraft || !draftHasChanges || draftStatementIds.length === 0}
                        className="gap-2 border-border text-foreground/90"
                      >
                        <Save size={15} />
                        {savingDraft ? 'Saving...' : 'Save Draft'}
                      </Button>
                      <Button
                        onClick={() => void handleGenerateInvoice()}
                        disabled={generating || draftStatementIds.length === 0}
                        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        <Sparkles size={15} />
                        {generating ? 'Generating...' : 'Generate Invoice'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={deletingInvoice}
                        className="gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <Trash2 size={15} />
                        Delete Invoice
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleMoveToDraft()}
                        disabled={movingToDraft}
                        className="gap-2 border-border text-foreground/90 hover:bg-muted"
                      >
                        <FileText size={15} />
                        {movingToDraft ? 'Moving to Draft...' : 'Move to Draft'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    <FileText size={14} />
                    Statements
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeInvoice.statements.map((statement) => (
                      <span
                        key={statement.id}
                        className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground/80"
                      >
                        {statement.accountName}
                      </span>
                    ))}
                  </div>

                  {activeInvoice.status === 'draft' ? (
                    <div className="grid gap-2 pt-2 md:grid-cols-2">
                      {activeInvoiceAvailableStatements.map((statement) => {
                        const checked = draftStatementIds.includes(statement.id)

                        return (
                          <label
                            key={statement.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                              checked
                                ? 'border-indigo-500/50 bg-indigo-500/10'
                                : 'border-border bg-background/70 hover:bg-card'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setDraftStatementIds((prev) => {
                                  if (e.target.checked) return [...prev, statement.id]
                                  return prev.filter((value) => value !== statement.id)
                                })
                              }}
                              className="mt-1 h-4 w-4 rounded border-border bg-card text-indigo-500"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">
                                {statement.account.accountName}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {statement.account.bankName} · {statement.importedCount} transactions
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Top Overview Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Spendings
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                      <Wallet size={14} />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold font-mono text-rose-400">
                    {formatINR(activeInvoice.analysis?.totalSpend ?? 0)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Regular: <span className="font-mono text-foreground/90 font-medium">{formatINR(activeInvoice.analysis?.regularSpend ?? 0)}</span></span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Zap size={11} className="text-amber-400" />
                      One-Time: <span className="font-mono text-amber-400 font-medium">{formatINR(activeInvoice.analysis?.oneTimeSpend ?? 0)}</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Savings & Investments
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <TrendingUp size={14} />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                    {formatINR(activeInvoice.analysis?.totalInvestments ?? 0)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Regular: <span className="font-mono text-foreground/90 font-medium">{formatINR(activeInvoice.analysis?.regularInvestments ?? 0)}</span></span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Zap size={11} className="text-amber-400" />
                      One-Time: <span className="font-mono text-amber-400 font-medium">{formatINR(activeInvoice.analysis?.oneTimeInvestments ?? 0)}</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Cash Outflow
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Receipt size={14} />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold font-mono text-foreground">
                    {formatINR(activeInvoice.analysis?.totalOutflow ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Spendings + Investments
                  </p>
                </div>
              </div>

              <Tabs defaultValue="transactions" className="w-full space-y-4">
                <TabsList className="bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                  <TabsTrigger value="transactions" className="flex items-center gap-2">
                    <Receipt size={14} />
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="flex items-center gap-2">
                    <Sparkles size={14} />
                    Analysis (Who spent what)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="transactions" className="space-y-4 outline-none">
                  <div className="rounded-2xl border border-border bg-card/50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Transactions</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {filteredTransactions.length} of {activeInvoice.transactions.length} transactions
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {activeInvoice.status === 'draft' && selectedTransactionIds.size > 0 && (
                          <div className="flex items-center gap-1.5 mr-1 pr-2 border-r border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleBulkOneTime(true)}
                              className="h-9 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs"
                            >
                              <Zap size={13} />
                              Mark One-Time
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleBulkOneTime(false)}
                              className="h-9 gap-1.5 border-border bg-background text-foreground/80 hover:bg-muted text-xs"
                            >
                              Mark Regular
                            </Button>
                          </div>
                        )}

                        <div className="relative min-w-52">
                          <Search
                            size={15}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter by description"
                            className="border-border bg-background pl-8 text-foreground text-xs"
                          />
                        </div>

                        <Select
                          value={natureFilter}
                          onValueChange={(value) => setNatureFilter(value as 'all' | 'regular' | 'one_time' | 'investment')}
                        >
                          <SelectTrigger className="w-[170px] border-border bg-background text-foreground/90 text-xs">
                            <SelectValue placeholder="Nature" />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            <SelectItem value="all">All items</SelectItem>
                            <SelectItem value="regular">Regular spending</SelectItem>
                            <SelectItem value="one_time">⚡ One-time only</SelectItem>
                            <SelectItem value="investment">📈 Investments only</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={categoryFilter}
                          onValueChange={(value) => setCategoryFilter(value ?? 'all')}
                        >
                          <SelectTrigger className="w-[160px] border-border bg-background text-foreground/90 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <Filter size={13} className="text-muted-foreground shrink-0" />
                              <SelectValue placeholder="Category">
                                {categoryFilter === 'all'
                                  ? 'All categories'
                                  : categoryOptions.find((o) => o.value === categoryFilter)?.label ?? 'Category'}
                              </SelectValue>
                            </div>
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            <SelectItem value="all">All categories</SelectItem>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="outline"
                                className="w-[160px] justify-start border-border bg-background text-foreground/90 hover:bg-background hover:text-foreground text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <User size={13} className="text-muted-foreground" />
                                  <span className="truncate">
                                    {ownerFilter.length === 0
                                      ? 'All assignees'
                                      : ownerFilter.length === 1
                                        ? ownerOptions.find((o) => o.value === ownerFilter[0])?.label ??
                                        '1 selected'
                                        : `${ownerFilter.length} selected`}
                                  </span>
                                </div>
                              </Button>
                            }
                          />
                          <DropdownMenuContent className="w-[160px] border-border bg-card">
                            {ownerOptions.map((option) => (
                              <DropdownMenuCheckboxItem
                                key={option.value}
                                checked={ownerFilter.includes(option.value)}
                                onCheckedChange={(checked) => {
                                  setOwnerFilter((prev) => {
                                    if (checked) return [...prev, option.value]
                                    return prev.filter((v) => v !== option.value)
                                  })
                                }}
                              >
                                {option.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Select
                          value={typeFilter}
                          onValueChange={(value) => setTypeFilter(value as 'all' | 'debit' | 'credit')}
                        >
                          <SelectTrigger className="w-[140px] border-border bg-background text-foreground/90 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card">
                            <SelectItem value="all">All amounts</SelectItem>
                            <SelectItem value="debit">Debit only</SelectItem>
                            <SelectItem value="credit">Credit only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {filteredTransactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                          <Receipt size={24} className="text-muted-foreground/70" />
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">No matching transactions</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Adjust the filters or add more statements to this invoice.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-background/80">
                            <tr className="border-b border-border">
                              {activeInvoice.status === 'draft' ? (
                                <th className="sticky left-0 z-20 bg-card border-r border-border/50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={(e) => toggleFilteredSelection(e.target.checked)}
                                    className="h-4 w-4 rounded border-border bg-card text-indigo-500"
                                    aria-label="Select all filtered transactions"
                                  />
                                </th>
                              ) : null}
                              <th
                                onClick={() => handleSort('date')}
                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>Date</span>
                                  {sortField === 'date' ? (
                                    sortDirection === 'asc' ? <ArrowUp size={12} className="text-indigo-400" /> : <ArrowDown size={12} className="text-indigo-400" />
                                  ) : (
                                    <ArrowUpDown size={12} className="opacity-40" />
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Description
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Category
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                One-Time?
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Statement
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Owners
                              </th>
                              <th
                                onClick={() => handleSort('amount')}
                                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>Amount</span>
                                  {sortField === 'amount' ? (
                                    sortDirection === 'asc' ? <ArrowUp size={12} className="text-indigo-400" /> : <ArrowDown size={12} className="text-indigo-400" />
                                  ) : (
                                    <ArrowUpDown size={12} className="opacity-40" />
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {filteredTransactions.map((transaction) => (
                              <tr key={transaction.id} className="group hover:bg-muted/30">
                                {activeInvoice.status === 'draft' ? (
                                  <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 border-r border-border/50 px-4 py-3 align-top">
                                    <input
                                      type="checkbox"
                                      checked={selectedTransactionIds.has(transaction.id)}
                                      onChange={(e) =>
                                        toggleTransactionSelection(transaction.id, e.target.checked)
                                      }
                                      className="mt-0.5 h-4 w-4 rounded border-border bg-card text-indigo-500"
                                      aria-label={`Select transaction ${transaction.description}`}
                                    />
                                  </td>
                                ) : null}
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                  {formatShortDate(transaction.date)}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="max-w-md truncate text-foreground">
                                    {transaction.description}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  {activeInvoice.status === 'draft' ? (
                                    <CategoryPicker
                                      categoryId={transaction.categoryId}
                                      category={transaction.category}
                                      onUpdate={(categoryId) =>
                                        handleCategoryUpdate(transaction.id, categoryId)
                                      }
                                    />
                                  ) : transaction.category ? (
                                    <div className="flex items-center gap-1.5">
                                      <CategoryBadge
                                        name={transaction.category.name}
                                        color={transaction.category.color ?? '#6366f1'}
                                      />
                                      {transaction.category.type && transaction.category.type !== 'expense' && (
                                        <span className={cn(
                                          "text-[9px] px-1 py-0.2 rounded font-medium uppercase",
                                          transaction.category.type === 'investment' ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
                                          transaction.category.type === 'income' ? "bg-sky-500/15 text-sky-300 border border-sky-500/30" :
                                          "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                        )}>
                                          {transaction.category.type === 'investment' ? '📈 Invest' : transaction.category.type}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">— Uncategorized</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {activeInvoice.status === 'draft' ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleOneTime(transaction)}
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                                        transaction.isOneTime
                                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                      )}
                                      title="Click to toggle One-Time vs Regular"
                                    >
                                      {transaction.isOneTime ? (
                                        <>
                                          <Zap size={12} className="text-amber-400" />
                                          One-Time
                                        </>
                                      ) : (
                                        'Regular'
                                      )}
                                    </button>
                                  ) : (
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium',
                                        transaction.isOneTime
                                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                          : 'border-border bg-muted/40 text-muted-foreground'
                                      )}
                                    >
                                      {transaction.isOneTime ? (
                                        <>
                                          <Zap size={12} className="text-amber-400" />
                                          One-Time
                                        </>
                                      ) : (
                                        'Regular'
                                      )}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {statementLabels.get(transaction.statementId) ?? 'Statement removed'}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    disabled={activeInvoice.status !== 'draft'}
                                    onClick={() => {
                                      if (activeInvoice.status === 'draft') {
                                        setSplitTarget(transaction)
                                      }
                                    }}
                                    className={cn(
                                      'rounded-lg transition-colors',
                                      activeInvoice.status === 'draft'
                                        ? 'cursor-pointer hover:bg-muted/60'
                                        : 'cursor-default'
                                    )}
                                  >
                                    <OwnerAvatars
                                      owners={transaction.owners.map((owner) => ({
                                        name: owner.name,
                                        color: owner.color ?? 'indigo',
                                      }))}
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                  <span
                                    className={
                                      transaction.type === 'debit'
                                        ? 'text-rose-400'
                                        : 'text-emerald-400'
                                    }
                                  >
                                    {transaction.type === 'debit' ? '−' : '+'}
                                    {formatINR(transaction.amount)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-background/50 border-t border-border">
                            <tr>
                              {activeInvoice.status === 'draft' ? (
                                <td className="sticky left-0 z-10 bg-card border-r border-border/50 px-4 py-4"></td>
                              ) : null}
                              <td
                                className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                                colSpan={6}
                              >
                                Sub-total <span className="normal-case font-normal text-muted-foreground/75 ml-1.5">(Avg: {formatINR(filteredAverage)})</span>
                              </td>
                              <td className="px-4 py-4 text-right font-mono whitespace-nowrap">
                                <span
                                  className={cn(
                                    'text-base font-bold',
                                    filteredTotal < 0 ? 'text-rose-400' : 'text-emerald-400'
                                  )}
                                >
                                  {filteredTotal < 0 ? '−' : '+'}
                                  {formatINR(Math.abs(filteredTotal))}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="analysis" className="space-y-4 outline-none">
                  {activeInvoice.analysis ? (
                    <div className="rounded-2xl border border-border bg-card/50 p-6">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-400" />
                        <h3 className="text-lg font-semibold text-foreground">Analysis (Who spent what)</h3>
                      </div>

                      {/* Who spent how much (Multi-tier owner breakdown) */}
                      <div className="mt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <User size={15} className="text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground/90">Who spent how much?</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {activeInvoice.analysis.ownerTotals.map((owner) => (
                            <div
                              key={`${owner.ownerId ?? owner.name}-total`}
                              className="rounded-2xl border border-border bg-background/70 p-5 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="h-3.5 w-3.5 rounded-full"
                                    style={{ backgroundColor: owner.color ?? '#71717a' }}
                                  />
                                  <span className="text-base font-semibold text-foreground">{owner.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className={cn(
                                    "font-mono text-base font-bold",
                                    owner.total < 0 ? "text-emerald-400" : "text-foreground"
                                  )}>
                                    {owner.total < 0 ? '−' : ''}{formatINR(owner.total)}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                    {owner.total < 0 ? 'Net Inflow / Surplus' : 'Net Outflow'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                                <div className="rounded-lg bg-card/60 p-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-medium text-muted-foreground">Living Spend</p>
                                    <span className={cn(
                                      "font-mono font-bold",
                                      (owner.spendingTotal ?? 0) < 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                      {(owner.spendingTotal ?? 0) < 0 ? '−' : ''}{formatINR(owner.spendingTotal ?? 0)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                    <span>Regular: <span className="font-mono text-foreground/90">{(owner.regularSpendingTotal ?? 0) < 0 ? '−' : ''}{formatINR(owner.regularSpendingTotal ?? 0)}</span></span>
                                    <span className="flex items-center gap-0.5">
                                      <Zap size={9} className="text-amber-400" />
                                      <span className="font-mono text-amber-400">{(owner.oneTimeSpendingTotal ?? 0) < 0 ? '−' : ''}{formatINR(owner.oneTimeSpendingTotal ?? 0)}</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="rounded-lg bg-card/60 p-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                      <TrendingUp size={11} className="text-emerald-400" />
                                      Savings & Invest
                                    </p>
                                    <span className="font-mono font-bold text-emerald-400">{formatINR(owner.investmentTotal ?? 0)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                    <span>Regular: <span className="font-mono text-foreground/90">{formatINR(owner.regularInvestmentTotal ?? 0)}</span></span>
                                    <span className="flex items-center gap-0.5">
                                      <Zap size={9} className="text-amber-400" />
                                      <span className="font-mono text-amber-400">{formatINR(owner.oneTimeInvestmentTotal ?? 0)}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Category-wise Breakdown: Split Expenses vs Savings */}
                      <div className="mt-6 grid gap-6 md:grid-cols-2">
                        {/* Expense Categories */}
                        <div className="rounded-2xl border border-border bg-background/70 p-5">
                          <div className="flex items-center gap-2">
                            <Layers size={15} className="text-rose-400" />
                            <p className="text-sm font-semibold text-foreground/90">Living Expenses by Category</p>
                          </div>
                          <div className="mt-4 space-y-3">
                            {activeInvoice.analysis.categoryTotals &&
                            activeInvoice.analysis.categoryTotals.filter((c) => c.type !== 'investment').length > 0 ? (
                              activeInvoice.analysis.categoryTotals
                                .filter((c) => c.type !== 'investment')
                                .map((category) => (
                                  <div
                                    key={`${category.categoryId ?? 'uncategorized'}:${category.category}-total`}
                                    className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: category.color ?? '#71717a' }}
                                      />
                                      <div>
                                        <span className="font-medium text-foreground">{category.category}</span>
                                        {(category.oneTimeTotal ?? 0) > 0 && (
                                          <span className="ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 bg-amber-500/10 text-[10px] text-amber-300 font-mono">
                                            <Zap size={9} />
                                            {formatINR(category.oneTimeTotal ?? 0)} one-time
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="font-mono text-rose-400 font-semibold">{formatINR(category.total)}</span>
                                  </div>
                                ))
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-4">No expense category data.</p>
                            )}
                          </div>
                        </div>

                        {/* Investment / Savings Categories */}
                        <div className="rounded-2xl border border-border bg-background/70 p-5">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={15} className="text-emerald-400" />
                            <p className="text-sm font-semibold text-foreground/90">Savings & Investments</p>
                          </div>
                          <div className="mt-4 space-y-3">
                            {activeInvoice.analysis.categoryTotals &&
                            activeInvoice.analysis.categoryTotals.filter((c) => c.type === 'investment').length > 0 ? (
                              activeInvoice.analysis.categoryTotals
                                .filter((c) => c.type === 'investment')
                                .map((category) => (
                                  <div
                                    key={`${category.categoryId ?? 'uncategorized'}:${category.category}-total`}
                                    className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: category.color ?? '#10b981' }}
                                      />
                                      <div>
                                        <span className="font-medium text-foreground">{category.category}</span>
                                        {(category.oneTimeTotal ?? 0) > 0 && (
                                          <span className="ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 bg-amber-500/10 text-[10px] text-amber-300 font-mono">
                                            <Zap size={9} />
                                            {formatINR(category.oneTimeTotal ?? 0)} one-time
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="font-mono text-emerald-400 font-semibold">{formatINR(category.total)}</span>
                                  </div>
                                ))
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-4">No investment categories in this invoice.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Who spent how much in each category? */}
                      <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5">
                        <div className="flex items-center gap-2">
                          <Tag size={15} className="text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground/90">
                            Who spent how much in each category?
                          </p>
                        </div>
                        <div className="mt-5 space-y-4">
                          {activeInvoice.analysis.ownerCategoryTotals.map((owner) => {
                            const ownerKey = owner.ownerId ?? owner.name
                            const isOwnerExpanded = !collapsedOwners.has(ownerKey)

                            return (
                              <div
                                key={`${ownerKey}-section`}
                                className="rounded-xl border border-border bg-card/40 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleOwnerCollapse(ownerKey)}
                                  className="flex w-full items-center justify-between bg-card/65 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: owner.color ?? '#71717a' }}
                                    />
                                    <span className="font-semibold text-foreground">{owner.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({owner.categories.length} categories)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={cn(
                                      "font-mono font-bold",
                                      owner.total < 0 ? "text-emerald-400" : "text-foreground"
                                    )}>
                                      {owner.total < 0 ? '−' : ''}{formatINR(owner.total)}
                                    </span>
                                    <ChevronDown
                                      size={16}
                                      className={cn(
                                        "text-muted-foreground transition-transform duration-200",
                                        isOwnerExpanded && "rotate-180"
                                      )}
                                    />
                                  </div>
                                </button>

                                {isOwnerExpanded && (
                                  <div className="p-4 bg-background/30 border-t border-border/60 space-y-3">
                                    {owner.categories.map((category) => {
                                      const expandKey = `${ownerKey}:${category.categoryId ?? 'uncategorized'}:${category.category}`
                                      const isExpanded = expandedCategories.has(expandKey)

                                      const matchingTxns = activeInvoice.transactions.filter((t) => {
                                        const catMatch = category.categoryId 
                                          ? t.categoryId === category.categoryId 
                                          : !t.categoryId

                                        if (!catMatch) return false

                                        return t.owners.some((o) => 
                                          owner.ownerId ? o.ownerId === owner.ownerId : o.name === owner.name
                                        )
                                      })

                                      const isInv = category.type === 'investment'

                                      return (
                                        <div
                                          key={expandKey}
                                          className="rounded-xl border border-border bg-card/60 overflow-hidden"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => toggleCategoryExpand(ownerKey, category.categoryId, category.category)}
                                            className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium text-foreground">{category.category}</span>
                                              {isInv && (
                                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 bg-emerald-500/10 text-[10px] text-emerald-400 font-medium">
                                                  <TrendingUp size={10} />
                                                  Savings
                                                </span>
                                              )}
                                              {(category.oneTimeTotal ?? 0) > 0 && (
                                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 bg-amber-500/10 text-[10px] text-amber-300 font-mono">
                                                  <Zap size={10} />
                                                  {formatINR(category.oneTimeTotal ?? 0)} one-time
                                                </span>
                                              )}
                                              <span className="text-xs text-muted-foreground">({matchingTxns.length} items)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className={cn("font-mono text-sm font-semibold", isInv ? "text-emerald-400" : "text-foreground")}>
                                                {formatINR(category.total)}
                                              </span>
                                              <ChevronDown
                                                size={15}
                                                className={cn(
                                                  "text-muted-foreground transition-transform duration-200",
                                                  isExpanded && "rotate-180"
                                                )}
                                              />
                                            </div>
                                          </button>

                                          {isExpanded && (
                                            <div className="border-t border-border bg-background/50 divide-y divide-border/60 px-3 py-1">
                                              {matchingTxns.length === 0 ? (
                                                <p className="p-3 text-xs text-muted-foreground text-center">No items found</p>
                                              ) : (
                                                matchingTxns.map((txn) => {
                                                  const ownerShare = txn.owners.find((o) => 
                                                    owner.ownerId ? o.ownerId === owner.ownerId : o.name === owner.name
                                                  )
                                                  const shareAmount = ownerShare ? parseFloat(ownerShare.amount) : 0
                                                  const signedAmount = txn.type === 'credit' ? -shareAmount : shareAmount

                                                  return (
                                                    <div key={txn.id} className="flex items-center justify-between p-2.5 text-xs">
                                                      <div className="min-w-0 flex-1 pr-3">
                                                        <div className="flex items-center gap-1.5">
                                                          <p className="truncate font-medium text-foreground">{txn.description}</p>
                                                          {txn.isOneTime && (
                                                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                                                              <Zap size={9} />
                                                              One-Time
                                                            </span>
                                                          )}
                                                        </div>
                                                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                          {formatShortDate(txn.date)}
                                                          {ownerShare && (
                                                            <span className="ml-1.5 font-mono">
                                                              ({ownerShare.percentage}% of {formatINR(txn.amount)})
                                                            </span>
                                                          )}
                                                        </p>
                                                      </div>
                                                      <span className={cn(
                                                        "font-mono whitespace-nowrap font-semibold",
                                                        signedAmount < 0 ? "text-emerald-400" : isInv ? "text-emerald-400" : "text-rose-400"
                                                      )}>
                                                        {signedAmount < 0 ? '−' : '+'}
                                                        {formatINR(Math.abs(signedAmount))}
                                                      </span>
                                                    </div>
                                                  )
                                                })
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
                      No analysis data available. Add some statements first.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </section>
      </div>

      <SplitOwnerModal
        open={!!splitTarget}
        onClose={() => setSplitTarget(null)}
        transaction={
          splitTarget
            ? {
              id: splitTarget.id,
              description: splitTarget.description,
              amount: splitTarget.amount,
              transactionOwners: splitTarget.owners
                .filter((owner) => owner.ownerId)
                .map((owner) => ({ ownerId: owner.ownerId! })),
            }
            : null
        }
        owners={owners}
        onSave={handleOwnerSave}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete invoice"
        description={
          activeInvoice
            ? `Delete "${activeInvoice.name}"? This removes the invoice snapshot and draft metadata, but keeps the original transactions and statements.`
            : undefined
        }
        confirmLabel="Delete invoice"
        destructive={true}
        loading={deletingInvoice}
        onConfirm={handleDeleteInvoice}
      />

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
                ? `You have ${pendingCategoryChange.selectedIds.length} selected filtered rows. Do you want to apply this category change to all of them?`
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
              onClick={() => void handleApplyOnlyThisRow()}
              disabled={applyingCategoryChange}
              className="border-border text-foreground/90 hover:bg-muted"
            >
              No, only this row
            </Button>
            <Button
              onClick={() => void handleApplyToSelectedRows()}
              disabled={applyingCategoryChange}
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {applyingCategoryChange ? 'Applying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                ? `You have ${pendingOwnerChange.selectedIds.length} selected filtered rows. Do you want to apply this ownership change to all of them?`
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
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {applyingOwnerChange ? 'Applying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

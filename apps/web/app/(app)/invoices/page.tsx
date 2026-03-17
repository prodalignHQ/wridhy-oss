'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText,
  Filter,
  Plus,
  Receipt,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
  categoryId: string | null
  category: {
    id: string | null
    name: string
    color: string | null
  } | null
  owners: InvoiceOwnerShare[]
}

interface InvoiceAnalysis {
  ownerTotals: Array<{
    ownerId: string | null
    name: string
    color: string | null
    total: number
  }>
  ownerCategoryTotals: Array<{
    ownerId: string | null
    name: string
    color: string | null
    total: number
    categories: Array<{
      categoryId: string | null
      category: string
      total: number
    }>
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
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{title}</h2>
        <span className="text-xs text-zinc-600">{invoices.length}</span>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-600">
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
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{invoice.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatMonth(invoice.invoiceMonth)}</p>
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
                      className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-[11px] text-zinc-400"
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
  const [deletingInvoice, setDeletingInvoice] = useState(false)
  const [applyingCategoryChange, setApplyingCategoryChange] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [splitTarget, setSplitTarget] = useState<InvoiceTransaction | null>(null)
  const [pendingCategoryChange, setPendingCategoryChange] = useState<{
    transactionId: string
    categoryId: string | null
    selectedIds: string[]
  } | null>(null)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set())

  const [newInvoiceName, setNewInvoiceName] = useState('')
  const [newInvoiceMonth, setNewInvoiceMonth] = useState('')
  const [newStatementIds, setNewStatementIds] = useState<string[]>([])

  const [draftName, setDraftName] = useState('')
  const [draftStatementIds, setDraftStatementIds] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'debit' | 'credit'>('all')

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

  const filteredTransactions = useMemo(() => {
    return (activeInvoice?.transactions ?? []).filter((transaction) => {
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(search.trim().toLowerCase())
      const transactionCategory = transaction.categoryId ?? 'uncategorized'
      const matchesCategory = categoryFilter === 'all' || transactionCategory === categoryFilter
      const matchesType = typeFilter === 'all' || transaction.type === typeFilter

      return matchesSearch && matchesCategory && matchesType
    })
  }, [activeInvoice, categoryFilter, search, typeFilter])

  const filteredTransactionIds = useMemo(
    () => filteredTransactions.map((transaction) => transaction.id),
    [filteredTransactions]
  )

  const selectedFilteredCount = useMemo(
    () => filteredTransactionIds.filter((id) => selectedTransactionIds.has(id)).length,
    [filteredTransactionIds, selectedTransactionIds]
  )

  const selectedFilteredIds = useMemo(
    () => filteredTransactionIds.filter((id) => selectedTransactionIds.has(id)),
    [filteredTransactionIds, selectedTransactionIds]
  )

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

  const loadInvoiceDetail = useCallback(async (invoiceId: string) => {
    setDetailLoading(true)

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
      setDetailLoading(false)
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

  const handleOwnerSave = async (ownerIds: string[]) => {
    if (!splitTarget || !activeInvoice || activeInvoice.status !== 'draft') return

    try {
      await apiClient.fetch(`/v1/transactions/${splitTarget.id}/owners`, {
        method: 'PUT',
        body: JSON.stringify({ ownerIds }),
      })

      toast.success('Owners updated')
      await loadInvoiceDetail(activeInvoice.id)
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

      await loadInvoiceDetail(activeInvoice.id)
    },
    [activeInvoice, loadInvoiceDetail]
  )

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
        `Updated category for ${pendingCategoryChange.selectedIds.length} selected transaction${
          pendingCategoryChange.selectedIds.length === 1 ? '' : 's'
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-zinc-500">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Invoices</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
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
        <aside className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                  <Receipt size={22} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-zinc-50">Create invoice draft</h2>
                  <p className="text-sm text-zinc-500">
                    Pick a tagged month, select the statements to include, and start editing the
                    invoice before you generate it.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Invoice Name
                    </label>
                    <Input
                      value={newInvoiceName}
                      onChange={(e) => setNewInvoiceName(e.target.value)}
                      className="border-zinc-700 bg-zinc-950 text-zinc-100"
                      placeholder="March 2026 household invoice"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Invoice Month
                    </label>
                    <Input
                      type="month"
                      value={newInvoiceMonth}
                      onChange={(e) => setNewInvoiceMonth(e.target.value)}
                      className="border-zinc-700 bg-zinc-950 text-zinc-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Statements For {newInvoiceMonth ? formatMonth(newInvoiceMonth) : 'This Month'}
                      </label>
                      <span className="text-xs text-zinc-600">
                        {newStatementIds.length} selected
                      </span>
                    </div>

                    {newMonthStatements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-600">
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
                                  : 'border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900'
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
                                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-zinc-100">
                                  {statement.account.accountName}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
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

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    What happens next
                  </p>
                  <div className="mt-4 space-y-4 text-sm text-zinc-400">
                    <div>
                      <p className="font-medium text-zinc-200">1. Draft is created</p>
                      <p className="mt-1">
                        The draft appears in the Drafts section so you can come back to it anytime.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200">2. Edit transactions</p>
                      <p className="mt-1">
                        Categorize rows, assign owners, and filter down by description, category, or
                        debit versus credit.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200">3. Generate snapshot</p>
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
            <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <div className="text-zinc-500">Loading invoice...</div>
            </div>
          ) : !activeInvoice ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <div className="text-zinc-500">Select an invoice to continue.</div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    {activeInvoice.status === 'draft' ? (
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-11 max-w-xl border-zinc-700 bg-zinc-950 text-xl font-semibold text-zinc-50"
                      />
                    ) : (
                      <div>
                        <h2 className="text-2xl font-semibold text-zinc-50">{activeInvoice.name}</h2>
                        <p className="mt-1 text-sm text-zinc-500">
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
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs font-semibold text-zinc-300">
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
                        className="gap-2 border-zinc-700 text-zinc-200"
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
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={deletingInvoice}
                      className="gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Trash2 size={15} />
                      Delete Invoice
                    </Button>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    <FileText size={14} />
                    Statements
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeInvoice.statements.map((statement) => (
                      <span
                        key={statement.id}
                        className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs text-zinc-300"
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
                                : 'border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900'
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
                              className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-zinc-100">
                                {statement.account.accountName}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
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

              {activeInvoice.status === 'generated' && activeInvoice.analysis ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-400" />
                    <h3 className="text-lg font-semibold text-zinc-50">Analysis</h3>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-zinc-500" />
                        <p className="text-sm font-semibold text-zinc-200">Who spent how much?</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {activeInvoice.analysis.ownerTotals.map((owner) => (
                          <div
                            key={`${owner.ownerId ?? owner.name}-total`}
                            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: owner.color ?? '#71717a' }}
                              />
                              <span className="font-medium text-zinc-100">{owner.name}</span>
                            </div>
                            <span className="font-mono text-rose-400">{formatINR(owner.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                      <div className="flex items-center gap-2">
                        <Tag size={15} className="text-zinc-500" />
                        <p className="text-sm font-semibold text-zinc-200">
                          Who spent how much in each category?
                        </p>
                      </div>
                      <div className="mt-4 space-y-4">
                        {activeInvoice.analysis.ownerCategoryTotals.map((owner) => (
                          <div key={`${owner.ownerId ?? owner.name}-categories`} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-zinc-100">{owner.name}</span>
                              <span className="font-mono text-zinc-300">{formatINR(owner.total)}</span>
                            </div>
                            <div className="space-y-2">
                              {owner.categories.map((category) => (
                                <div
                                  key={`${owner.ownerId ?? owner.name}-${category.category}`}
                                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5"
                                >
                                  <span className="text-sm text-zinc-300">{category.category}</span>
                                  <span className="font-mono text-zinc-100">
                                    {formatINR(category.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-50">Transactions</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {filteredTransactions.length} of {activeInvoice.transactions.length} transactions
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-56">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by description"
                        className="border-zinc-700 bg-zinc-950 pl-8 text-zinc-100"
                      />
                    </div>

                    <Select
                      value={categoryFilter}
                      onValueChange={(value) => setCategoryFilter(value ?? 'all')}
                    >
                      <SelectTrigger className="w-[180px] border-zinc-700 bg-zinc-950 text-zinc-200">
                        <div className="flex items-center gap-2">
                          <Filter size={14} className="text-zinc-500" />
                          <SelectValue placeholder="Category" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700 bg-zinc-900">
                        <SelectItem value="all">All categories</SelectItem>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={typeFilter}
                      onValueChange={(value) => setTypeFilter(value as 'all' | 'debit' | 'credit')}
                    >
                      <SelectTrigger className="w-[170px] border-zinc-700 bg-zinc-950 text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700 bg-zinc-900">
                        <SelectItem value="all">All amounts</SelectItem>
                        <SelectItem value="debit">Debit only</SelectItem>
                        <SelectItem value="credit">Credit only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
                      <Receipt size={24} className="text-zinc-600" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-400">No matching transactions</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Adjust the filters or add more statements to this invoice.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-950/80">
                        <tr className="border-b border-zinc-800">
                          {activeInvoice.status === 'draft' ? (
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={(e) => toggleFilteredSelection(e.target.checked)}
                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
                                aria-label="Select all filtered transactions"
                              />
                            </th>
                          ) : null}
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Description
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Statement
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Owners
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {filteredTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-zinc-800/30">
                            {activeInvoice.status === 'draft' ? (
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedTransactionIds.has(transaction.id)}
                                  onChange={(e) =>
                                    toggleTransactionSelection(transaction.id, e.target.checked)
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
                                  aria-label={`Select transaction ${transaction.description}`}
                                />
                              </td>
                            ) : null}
                            <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                              {formatShortDate(transaction.date)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="max-w-md truncate text-zinc-100">
                                {transaction.description}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-zinc-400">
                              {statementLabels.get(transaction.statementId) ?? 'Statement removed'}
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
                                <CategoryBadge
                                  name={transaction.category.name}
                                  color={transaction.category.color ?? '#6366f1'}
                                />
                              ) : (
                                <span className="text-xs text-zinc-500">— Uncategorized</span>
                              )}
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
                                    ? 'cursor-pointer hover:bg-zinc-800/60'
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
                    </table>
                  </div>
                )}
              </div>
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
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Apply category to selected rows?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {pendingCategoryChange
                ? `You have ${pendingCategoryChange.selectedIds.length} selected filtered rows. Do you want to apply this category change to all of them?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-zinc-800 bg-zinc-950/60">
            <Button
              variant="ghost"
              onClick={() => setPendingCategoryChange(null)}
              disabled={applyingCategoryChange}
              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              No
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleApplyOnlyThisRow()}
              disabled={applyingCategoryChange}
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
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
    </div>
  )
}

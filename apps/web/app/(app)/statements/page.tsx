'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { UploadCloud, Trash2, History, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadDropzone } from '@/components/statements/upload-dropzone'
import { apiClient } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { AmountBadge } from '@/components/ui/custom/AmountBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialAccount {
  id: string
  accountName: string
  accountType: string
  bankId: string
  bankName: string
}

interface Statement {
  id: string
  bankId: string
  accountId: string
  statementMonth: string
  parsedCount: number
  importedCount: number
  duplicatesSkipped: number
  importedAt: string
  account: { accountName: string; accountType: string; bankName: string }
}

interface PreviewRow {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

const BANKS = [
  { id: 'icici_savings', label: 'ICICI Bank — Savings Account', ext: '.xls' },
  { id: 'icici_credit', label: 'ICICI Bank — Credit Card', ext: '.csv' },
  { id: 'hdfc_savings', label: 'HDFC Bank — Savings Account', ext: '.xlsx' },
  { id: 'hdfc_credit', label: 'HDFC Bank — Credit Card', ext: '.xlsx' },
]

// ─── Preview Table ─────────────────────────────────────────────────────────────

function PreviewTable({ rows, totalCount }: { rows: PreviewRow[]; totalCount: number }) {
  const formatINR = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-card/80 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground/90">Preview</span>
        <span className="text-xs text-muted-foreground">
          Showing {rows.length} of {totalCount} transactions
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">Date</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">Description</th>
              <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">Amount</th>
              <th className="text-center px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                  {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-4 py-2.5 text-foreground/80 max-w-xs truncate">{row.description}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  <span className={row.type === 'debit' ? 'text-rose-400' : 'text-emerald-400'}>
                    {formatINR(row.amount)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.type === 'debit'
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {row.type === 'debit' ? '↑ Debit' : '↓ Credit'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Statement History ─────────────────────────────────────────────────────────

function StatementHistory({
  statements,
  onDelete,
}: {
  statements: Statement[]
  onDelete: (id: string) => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  // Group statements by month
  const groupedByMonth = statements.reduce((acc, s) => {
    const monthKey = s.statementMonth.slice(0, 7) // YYYY-MM
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(s)
    return acc
  }, {} as Record<string, Statement[]>)

  // Sort months descending
  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))

  // Expand all months when statements change
  useEffect(() => {
    const months = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))
    setExpandedMonths(new Set(months))
  }, [statements])

  if (statements.length === 0) return null

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }

  const getMonthTotal = (stmts: Statement[]) => {
    return stmts.reduce((sum, s) => sum + s.importedCount, 0)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Import History</h2>
      </div>

      <div className="space-y-4">
        {sortedMonths.map((month) => {
          const monthStatements = groupedByMonth[month]
          const isExpanded = expandedMonths.has(month)
          const totalImported = getMonthTotal(monthStatements)

          return (
            <div key={month} className="rounded-xl border border-border overflow-hidden">
              {/* Month Header */}
              <button
                onClick={() => toggleMonth(month)}
                className="w-full flex items-center justify-between px-4 py-3 bg-card/60 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    size={16}
                    className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="font-semibold text-foreground/90">{formatMonth(month)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/invoices?month=${month}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground/80 hover:border-primary/50 hover:text-foreground"
                  >
                    Create invoice
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {monthStatements.length} statement{monthStatements.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-mono text-emerald-400">
                    {totalImported} txn{totalImported !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>

              {/* Month Statements Table */}
              {isExpanded && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/30">
                      <th className="text-left px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Account</th>
                      <th className="text-left px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Bank</th>
                      <th className="text-right px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Imported</th>
                      <th className="text-right px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Skipped</th>
                      <th className="text-left px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Imported On</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {monthStatements.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground/90 font-medium">{s.account.accountName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {BANKS.find((b) => b.id === s.bankId)?.label ?? s.bankId}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">{s.importedCount}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.duplicatesSkipped}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(s.importedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(s.id)
                            }}
                            className="w-7 h-7 rounded hover:bg-rose-500/20 flex items-center justify-center text-muted-foreground/70 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null) }}
        title="Delete Statement"
        description="This will permanently delete this statement and all its imported transactions. This action cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatementsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [totalParsed, setTotalParsed] = useState(0)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')

  // Derived bankId from selected account
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const selectedBankId = selectedAccount?.bankId || ''

  // Load accounts and statements on mount
  useEffect(() => {
    apiClient.fetch<FinancialAccount[]>('/v1/accounts').then(setAccounts).catch(console.error)
    apiClient.fetch<Statement[]>('/v1/statements').then(setStatements).catch(console.error)
  }, [])

  // Backend preview parsing when file + bankId are selected
  useEffect(() => {
    if (!selectedFile || !selectedBankId) {
      setPreviewRows([])
      setTotalParsed(0)
      return
    }

    const fetchPreview = async () => {
      setIsParsing(true)
      try {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('bankId', selectedBankId)

        const baseURL = process.env.NEXT_PUBLIC_API_URL || ''
        const res = await fetch(`${baseURL}/v1/statements/preview`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        const result = await res.json()
        if (!res.ok || !result.success) throw new Error(result?.error?.message || 'Preview failed')

        const rows: PreviewRow[] = result.data

        // Derive default month from earliest transaction
        if (rows.length > 0) {
          const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          const earliest = new Date(sorted[0].date)
          const month = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, '0')}`
          setSelectedMonth(month)
        }

        setTotalParsed(rows.length)
        setPreviewRows(rows.slice(0, 20))
      } catch (err) {
        toast.error('Failed to preview file. Check the format.')
        console.error(err)
      } finally {
        setIsParsing(false)
      }
    }

    fetchPreview()
  }, [selectedFile, selectedBankId])

  const handleImport = async () => {
    if (!selectedFile || !selectedBankId || !selectedAccountId) {
      toast.error('Please select a bank, account, and file first')
      return
    }

    if (!selectedMonth) {
      toast.error('Please select a month to tag this statement')
      return
    }

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('bankId', selectedBankId)
      formData.append('accountId', selectedAccountId)
      formData.append('statementMonth', selectedMonth + '-01')

      const baseURL = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${baseURL}/v1/statements/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result?.error?.message || 'Upload failed')

      const { importedCount, duplicatesSkipped } = result.data
      toast.success(
        `Imported ${importedCount} transaction${importedCount !== 1 ? 's' : ''}` +
          (duplicatesSkipped > 0 ? ` · ${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} skipped` : '')
      )

      // Clear form and refresh
      setSelectedFile(null)
      setPreviewRows([])
      setTotalParsed(0)
      const updated = await apiClient.fetch<Statement[]>('/v1/statements')
      setStatements(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.fetch(`/v1/statements/${id}`, { method: 'DELETE' })
      setStatements((prev) => prev.filter((s) => s.id !== id))
      toast.success('Statement deleted')
    } catch {
      toast.error('Failed to delete statement')
    }
  }

  const canImport = !!selectedFile && !!selectedAccountId && totalParsed > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Statements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload bank statements to import transactions</p>
        </div>
      </div>

      {/* Upload section */}
      <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Import Statement</h2>

        {/* Account selector */}
        <Select value={selectedAccountId} onValueChange={(v) => setSelectedAccountId(v || '')}>
          <SelectTrigger className="bg-muted border-border text-foreground/90 w-full sm:w-[300px]" disabled={accounts.length === 0}>
            <SelectValue placeholder={accounts.length === 0 ? 'No accounts yet' : 'Select account'} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-foreground/90 focus:bg-muted">
                {a.accountName} — {a.bankName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Dropzone */}
        <UploadDropzone
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          onClear={() => {
            setSelectedFile(null)
            setPreviewRows([])
            setTotalParsed(0)
            setSelectedMonth('')
          }}
        />

        {/* Parsing indicator */}
        {isParsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
            Parsing statement…
          </div>
        )}

        {/* Month selector */}
        {totalParsed > 0 && !isParsing && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Tag to month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Preview */}
        {previewRows.length > 0 && !isParsing && (
          <PreviewTable rows={previewRows} totalCount={totalParsed} />
        )}

        {/* Import button */}
        {totalParsed > 0 && !isParsing && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                {totalParsed} transactions ready
              </span>
              <span className="text-muted-foreground/70">from {selectedFile?.name}</span>
            </div>
            <Button
              onClick={handleImport}
              disabled={!canImport || isImporting}
              className="bg-primary hover:bg-primary text-white gap-2"
            >
              <UploadCloud size={16} />
              {isImporting ? 'Importing…' : 'Confirm Import'}
            </Button>
          </div>
        )}
      </div>

      {/* History */}
      <StatementHistory statements={statements} onDelete={handleDelete} />

      {/* Empty history */}
      {statements.length === 0 && !isImporting && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <History size={26} className="text-muted-foreground/70" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground mb-1">No imports yet</p>
          <p className="text-xs text-muted-foreground/70">Your statement import history will appear here</p>
        </div>
      )}
    </div>
  )
}

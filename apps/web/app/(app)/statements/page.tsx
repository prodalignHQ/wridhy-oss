'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { UploadCloud, Trash2, History, ChevronRight, AlertTriangle, Mail, Landmark, FileSpreadsheet, Lock, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadDropzone } from '@/components/statements/upload-dropzone'
import { apiClient } from '@/lib/api'
import { readPendingStatements, writePendingStatements } from '@/lib/engine/opfs-db'
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
  /**
   * Permanent origin marker: true for rows composed from OPFS (their ids
   * never exist on the server). NEVER cleared — the merge below keys on it.
   */
  isLocal?: boolean
  /** Badge flag: true while no backup of any kind has landed for it. */
  localOnly?: boolean
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
                        <td className="px-4 py-3 text-foreground/90 font-medium">
                          {s.account.accountName}
                          {s.localOnly && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/25">
                              On-device
                            </span>
                          )}
                        </td>
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

interface ParseErrorState {
  fileName: string
  accountName: string
  bankName: string
  message?: string
}

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
  const [parseError, setParseError] = useState<ParseErrorState | null>(null)
  const [vaultGate, setVaultGate] = useState<null | {
    hasPassword: boolean
    wraps: Array<{ credentialId: string; label: string }>
  }>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateCredential, setGateCredential] = useState('')
  const [gateBusy, setGateBusy] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)

  // Derived bankId from selected account
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const selectedBankId = selectedAccount?.bankId || ''

  // Load accounts and statements on mount (with support for accountId query parameter)
  useEffect(() => {
    apiClient
      .fetch<FinancialAccount[]>('/v1/accounts')
      .then((accs) => {
        setAccounts(accs)
        const params = new URLSearchParams(window.location.search)
        const qAccountId = params.get('accountId')
        if (qAccountId && accs.some((a) => a.id === qAccountId)) {
          setSelectedAccountId(qAccountId)
        }
      })
      .catch(console.error)
    apiClient.fetch<Statement[]>('/v1/statements').then(async (list) => {
      setStatements(list)
      await refreshLocalStatements(list)
    }).catch(console.error)
    void refreshLocalStatements()
  }, [])

  // Local-first preview parsing (Web Worker + OPFS-ready engine) with server fallback
  useEffect(() => {
    if (!selectedFile || !selectedBankId) {
      setPreviewRows([])
      setTotalParsed(0)
      return
    }

    let cancelled = false
    const fetchPreview = async () => {
      setIsParsing(true)
      setParseError(null)
      try {
        // 1. Try entirely on-device first.
        const { parseStatementFile } = await import('@/lib/engine/worker-client')
        const localRows = await parseStatementFile(selectedBankId, selectedFile)
        if (cancelled) return
        if (localRows.length > 0) {
          finishPreview(localRows)
          return
        }
        // 2. Fall through to server preview when local yields nothing.
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
        if (!res.ok || !result.success) {
          throw new Error(result?.error?.message || 'Preview failed')
        }

        const rows: PreviewRow[] = result.data || []
        if (rows.length === 0) {
          throw new Error('No transactions found in this statement file.')
        }
        if (!cancelled) finishPreview(rows)
      } catch (err) {
        if (cancelled) return
        console.error('Preview error:', err)
        setPreviewRows([])
        setTotalParsed(0)
        setParseError({
          fileName: selectedFile.name,
          accountName: selectedAccount?.accountName || 'Selected account',
          bankName: selectedAccount?.bankName || selectedBankId,
          message: err instanceof Error ? err.message : 'Failed to parse statement',
        })
      } finally {
        if (!cancelled) setIsParsing(false)
      }
    }

    const finishPreview = (rows: PreviewRow[]) => {
      if (rows.length === 0) {
        throw new Error('No transactions found in this statement file.')
      }

      // Derive default month from earliest transaction
      if (rows.length > 0) {
        const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const earliest = new Date(sorted[0].date)
        const month = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, '0')}`
        setSelectedMonth(month)
      }

      setTotalParsed(rows.length)
      setPreviewRows(rows.slice(0, 20))
    }

    fetchPreview()
    return () => {
      cancelled = true
    }
  }, [selectedFile, selectedBankId, selectedAccount])

  const handleAccountChange = (accId: string | null) => {
    setSelectedAccountId(accId ?? '')
    setParseError(null)
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setPreviewRows([])
    setTotalParsed(0)
    setSelectedMonth('')
    setParseError(null)
  }

  const readPendingBackup = (): Set<string> => readPendingStatements()

  const writePendingBackup = (ids: Set<string>) => writePendingStatements(ids)

  const refreshLocalStatements = async (serverList?: Statement[]) => {
    try {
      const { readLocalCache } = await import('@/lib/engine/opfs-db')
      const cache = await readLocalCache()
      if (!cache) {
        setStatements((prev) => prev.filter((s) => !s.isLocal))
        return
      }
      const serverIds = new Set((serverList ?? statements).map((s) => s.id))
      const pending = readPendingBackup()
      const acctMap = new Map(cache.accounts.map((a) => [a.id, a]))
      const localOnly: Statement[] = cache.statements
        .filter((s) => !serverIds.has(s.id))
        .map((s) => {
          const acct = acctMap.get(s.accountId)
          return {
            id: s.id,
            bankId: s.bankId,
            accountId: s.accountId,
            statementMonth: s.statementMonth,
            parsedCount: s.parsedCount,
            importedCount: s.importedCount,
            duplicatesSkipped: s.duplicatesSkipped,
            importedAt: new Date().toISOString(),
            account: {
              accountName: acct?.accountName ?? 'On-device import',
              accountType: acct?.accountType ?? 'bank',
              bankName: acct?.bankName ?? s.bankId,
            },
            // Permanent origin marker (never cleared) + badge flag.
            isLocal: true,
            // Badge only while no backup of any kind has landed for it.
            localOnly: pending.has(s.id),
          }
        })
      // Merge on the origin marker, NOT the badge: backed-up local rows
      // (badge cleared) must replace, never duplicate. The old code keyed
      // on the badge and duplicated every backed-up row on each refresh.
      setStatements((prev) => [...prev.filter((s) => !s.isLocal), ...localOnly])
    } catch {
      // OPFS unavailable — server list stands alone
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !selectedBankId || !selectedAccountId) {
      setParseError({
        fileName: selectedFile?.name || 'Statement file',
        accountName: selectedAccount?.accountName || 'Selected account',
        bankName: selectedAccount?.bankName || selectedBankId,
        message: 'Please select an account and upload a statement file first.',
      })
      return
    }

    if (!selectedMonth) {
      toast.error('Please select a month to tag this statement')
      return
    }

    // Vault invariant: a vault exists ⇒ never plaintext. If the vault is
    // locked, stop here and ask for unlock instead of taking the legacy
    // readable-upload path. (Edits to pre-existing server rows keep their
    // current behavior — this gate covers new inbound data only.)
    const [{ fetchVaultBlob }, { useVaultStore }] = await Promise.all([
      import('@/lib/engine/vault-sync'),
      import('@/lib/store/vault.store'),
    ])
    const existing = await fetchVaultBlob().catch(() => null)
    if (existing && !useVaultStore.getState().isUnlocked()) {
      setVaultGate({
        hasPassword: !!existing.wrappedDekPassword,
        wraps: (existing.wraps ?? []).map((w) => ({ credentialId: w.credentialId, label: w.label })),
      })
      setGateCredential(existing.wraps?.[0]?.credentialId ?? '')
      setGateError(null)
      return
    }
    setVaultGate(null)

    setIsImporting(true)
    setParseError(null)
    let localStatementId: string | null = null
    try {
      // Step 1 — on-device import (instant, works offline).
      const [{ importStatementLocal }, { fetchReferenceData }] = await Promise.all([
        import('@/lib/engine/import'),
        import('@/lib/engine/analytics-client'),
      ])
      const ref = await fetchReferenceData()
      const local = await importStatementLocal({
        bankId: selectedBankId,
        accountId: selectedAccountId,
        statementMonth: selectedMonth + '-01',
        file: selectedFile,
        rules: ref.rules,
        categories: ref.categories,
        userMerchants: ref.userMerchants,
      })
      localStatementId = local.statementId
      const pending = readPendingBackup()
      pending.add(localStatementId)
      writePendingBackup(pending)
      await refreshLocalStatements()
      toast.success(
        `Saved ${local.importedCount} transaction${local.importedCount !== 1 ? 's' : ''} on this device` +
          (local.duplicatesSkipped > 0 ? ` · ${local.duplicatesSkipped} duplicate${local.duplicatesSkipped !== 1 ? 's' : ''} skipped` : '')
      )

      // Step 2 — backup. Encrypted vault sync when unlocked (ciphertext only);
      // otherwise the legacy file upload (plaintext rows, today's behavior).
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        try {
          await useVaultStore.getState().pushEncrypted()
          const done = readPendingBackup()
          done.delete(localStatementId)
          writePendingBackup(done)
          await refreshLocalStatements()
          toast.success('Backed up encrypted — the server sees only ciphertext')
        } catch (backupErr) {
          console.error('Encrypted backup failed:', backupErr)
          toast.warning('Saved on this device — encrypted backup failed. Retry from Settings → Vault → Sync now.')
        }
        // Clear form and refresh server list (unchanged by encrypted sync).
        setSelectedFile(null)
        setPreviewRows([])
        setTotalParsed(0)
        const updated = await apiClient.fetch<Statement[]>('/v1/statements')
        setStatements(updated)
        await refreshLocalStatements(updated)
        return
      }

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

      // Step 3 — converge: server rows supersede local rows, drop the local
      // statement shell, refresh everything.
      const [{ refreshLocalCache }, { deleteStatementFromCache }] = await Promise.all([
        import('@/lib/engine/analytics-client'),
        import('@/lib/engine/opfs-db'),
      ])
      await refreshLocalCache()
      if (localStatementId) {
        await deleteStatementFromCache(localStatementId).catch(() => {})
        const done = readPendingBackup()
        done.delete(localStatementId)
        writePendingBackup(done)
      }
      toast.success(
        `Synced ${importedCount} transaction${importedCount !== 1 ? 's' : ''} to server` +
          (duplicatesSkipped > 0 ? ` · ${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} skipped` : ''),
        { description: 'Readable server backup — no vault is set up, so this copy is not encrypted.' }
      )

      // Clear form and refresh
      setSelectedFile(null)
      setPreviewRows([])
      setTotalParsed(0)
      const updated = await apiClient.fetch<Statement[]>('/v1/statements')
      setStatements(updated)
      await refreshLocalStatements(updated)
    } catch (err) {
      console.error('Import error:', err)
      // Local-first guarantee: if we saved on-device but the server backup
      // failed, keep the data and tell the user it is safe locally.
      if (localStatementId) {
        await refreshLocalStatements()
        toast.warning('Saved on this device — server sync failed. Your data is safe locally; retry the upload later.')
        setSelectedFile(null)
        setPreviewRows([])
        setTotalParsed(0)
      } else {
        setParseError({
          fileName: selectedFile?.name || 'Statement file',
          accountName: selectedAccount?.accountName || 'Selected account',
          bankName: selectedAccount?.bankName || selectedBankId,
          message: err instanceof Error ? err.message : 'Import failed',
        })
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleGatePasswordUnlock = async () => {
    setGateBusy(true)
    setGateError(null)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      await useVaultStore.getState().unlockPassword(gatePassword)
      setGatePassword('')
      setVaultGate(null)
      toast.success('Vault unlocked — continuing import encrypted')
      await handleImport()
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setGateBusy(false)
    }
  }

  const handleGatePasskeyUnlock = async () => {
    setGateBusy(true)
    setGateError(null)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      await useVaultStore.getState().unlockPasskey(gateCredential || undefined)
      setVaultGate(null)
      toast.success('Vault unlocked — continuing import encrypted')
      await handleImport()
    } catch (err) {
      const { isPasskeyCancel } = await import('@/lib/engine/webauthn-prf')
      if (isPasskeyCancel(err)) return
      setGateError(err instanceof Error ? err.message : 'Passkey unlock failed')
    } finally {
      setGateBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { deleteStatementFromCache } = await import('@/lib/engine/opfs-db')
    const target = statements.find((s) => s.id === id)
    try {
      // Local-origin rows never exist on the server (their ids are client
      // UUIDs) — drop them locally regardless of backup/badge state.
      if (!target?.isLocal) {
        try {
          await apiClient.fetch(`/v1/statements/${id}`, { method: 'DELETE' })
        } catch (err) {
          // Already gone server-side (404): converge locally instead of
          // leaving a stale row behind.
          if ((err as { status?: number }).status !== 404) throw err
        }
      }
      setStatements((prev) => prev.filter((s) => s.id !== id))
      await deleteStatementFromCache(id).catch(() => {})
      await refreshLocalStatements()
      toast.success('Statement deleted')
    } catch {
      toast.error('Failed to delete statement')
    }
  }

  const canImport = !!selectedFile && !!selectedAccountId && totalParsed > 0 && !parseError

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
      <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Import Statement</h2>
          {selectedAccount && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              {selectedAccount.bankName} · {selectedAccount.accountType === 'credit_card' ? 'Credit Card' : 'Bank Account'}
            </span>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 flex flex-col items-center justify-center text-center bg-muted/20">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Landmark size={24} className="text-muted-foreground/70" />
            </div>
            <p className="text-sm font-semibold text-foreground/90 mb-1">No accounts found</p>
            <p className="text-xs text-muted-foreground mb-4">
              Add a bank or credit card account first to start importing statements.
            </p>
            <Link href="/accounts">
              <Button size="sm" variant="outline" className="gap-2 text-xs">
                <Landmark size={14} />
                Go to Accounts
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Account selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Step 1: Choose Account
                </label>
                {selectedAccountId && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                    ✓ Account selected
                  </span>
                )}
              </div>
              <Select value={selectedAccountId} onValueChange={handleAccountChange}>
                <SelectTrigger
                  id="account-select-trigger"
                  className="bg-muted border-border text-foreground/90 w-full sm:w-[340px]"
                >
                  <SelectValue placeholder="Choose an account to import into..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-foreground/90 focus:bg-muted">
                      {a.accountName} — {a.bankName} ({a.accountType === 'credit_card' ? 'Credit Card' : 'Bank'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedAccountId && (
                <p className="text-xs text-muted-foreground">
                  Select your bank or credit card account before uploading your statement file.
                </p>
              )}
            </div>

            {/* Step 2: Statement Dropzone - ONLY shown after account is chosen */}
            {!selectedAccountId ? (
              <div className="rounded-xl border border-dashed border-border/80 p-8 flex flex-col items-center justify-center text-center bg-muted/10">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <FileSpreadsheet size={24} className="text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground/80 mb-1">Choose an account above</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Once you select an account, you&apos;ll be able to drop your bank statement here for parsing.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Step 2: Upload Bank Statement
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Target: <strong className="text-foreground/90">{selectedAccount?.accountName}</strong>
                  </span>
                </div>

                <UploadDropzone
                  onFileSelect={(file) => {
                    setParseError(null)
                    setSelectedFile(file)
                  }}
                  selectedFile={selectedFile}
                  description={`Upload statements for ${selectedAccount?.accountName} (${selectedAccount?.bankName})`}
                  onClear={handleClearFile}
                />

                {/* Parsing error notification banner */}
                {parseError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/90 dark:border-rose-800/60 dark:bg-rose-950/40 p-5 space-y-4 animate-in fade-in-50 duration-200 shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-rose-100 border border-rose-200 dark:bg-rose-900/60 dark:border-rose-800 flex items-center justify-center shrink-0 text-rose-700 dark:text-rose-300 mt-0.5 shadow-2xs">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-rose-950 dark:text-rose-100">
                          Unable to parse statement
                        </h3>
                        <p className="text-sm text-rose-900 dark:text-rose-200/95 leading-relaxed">
                          We couldn&apos;t parse <span className="font-semibold text-rose-950 underline decoration-rose-400 dark:text-white dark:decoration-rose-400/60">{parseError.fileName}</span> with your selected account{' '}
                          <span className="font-semibold text-rose-950 dark:text-white">{parseError.accountName}</span> ({parseError.bankName}).
                        </p>
                        <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed">
                          You might have chosen the wrong account. Please check your account selection above or change it.
                        </p>
                        <div className="text-xs text-rose-800/90 dark:text-rose-300/80 leading-relaxed pt-2.5 border-t border-rose-200/80 dark:border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <span>
                            If we don&apos;t support this bank or statement format yet, please write to us to request adding support.
                          </span>
                          <a
                            href={`mailto:hello@rohanmallya.com?subject=${encodeURIComponent(
                              `Bank Support Request - ${parseError.bankName || 'New Bank'}`
                            )}&body=${encodeURIComponent(
                              `Hi Rohan,\n\nI tried importing a statement for ${parseError.accountName} (${parseError.bankName}) with file "${parseError.fileName}", but parsing failed.\n\nCould you please add support for this statement format?\n\nThanks!`
                            )}`}
                            className="inline-flex items-center gap-1.5 text-xs text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg px-2.5 py-1.5 font-medium transition-colors shrink-0 w-fit shadow-xs"
                          >
                            <Mail size={13} />
                            Write to hello@rohanmallya.com
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/80 dark:border-rose-800/40">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const trigger = document.getElementById('account-select-trigger')
                          trigger?.focus()
                          trigger?.click()
                        }}
                        className="border-rose-300 bg-white hover:bg-rose-100/70 text-rose-900 shadow-2xs dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100 dark:hover:bg-rose-900/70 text-xs h-8 font-medium"
                      >
                        Change Account
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFile}
                        className="text-rose-800 hover:text-rose-950 hover:bg-rose-100/70 dark:text-rose-300 dark:hover:text-white dark:hover:bg-rose-900/30 text-xs h-8 font-medium"
                      >
                        Try another file
                      </Button>
                    </div>
                  </div>
                )}

                {/* Parsing indicator */}
                {isParsing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                    Parsing statement…
                  </div>
                )}

                {/* Month selector */}
                {totalParsed > 0 && !isParsing && !parseError && (
                  <div className="flex items-center gap-3 pt-2">
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
                {previewRows.length > 0 && !isParsing && !parseError && (
                  <PreviewTable rows={previewRows} totalCount={totalParsed} />
                )}

                {/* Import button */}
                {totalParsed > 0 && !isParsing && !parseError && (
                  <div className="flex items-center justify-between pt-2">
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

                {/* Vault gate: a vault exists but is locked — unlock here so
                    this import stays encrypted instead of taking the legacy
                    readable-upload path. */}
                {vaultGate && !isParsing && !parseError && (
                  <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0 text-sky-500">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Unlock your vault to continue</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          You set up an encrypted vault, so this import waits for unlock — without it we&apos;d have
                          to store a readable copy, and that would defeat the vault.
                        </p>
                      </div>
                    </div>
                    {vaultGate.hasPassword && (
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Vault password"
                          value={gatePassword}
                          onChange={(e) => setGatePassword(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <Button onClick={handleGatePasswordUnlock} disabled={gateBusy || !gatePassword} size="sm" className="shrink-0">
                          {gateBusy ? 'Unlocking…' : 'Unlock'}
                        </Button>
                      </div>
                    )}
                    {vaultGate.wraps.length > 0 && (
                      <div className="flex gap-2">
                        {vaultGate.wraps.length > 1 && (
                          <Select value={gateCredential} onValueChange={(v) => setGateCredential(v ?? '')}>
                            <SelectTrigger className="h-9 text-sm bg-muted border-border flex-1">
                              <SelectValue placeholder="Choose device" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {vaultGate.wraps.map((w) => (
                                <SelectItem key={w.credentialId} value={w.credentialId}>
                                  {w.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button onClick={handleGatePasskeyUnlock} disabled={gateBusy} size="sm" variant={vaultGate.hasPassword ? 'outline' : 'default'} className="shrink-0 gap-1.5">
                          <Fingerprint size={14} />
                          {gateBusy ? 'Waiting…' : vaultGate.wraps.length > 1 ? 'Unlock with passkey' : `Unlock (${vaultGate.wraps[0]?.label ?? 'passkey'})`}
                        </Button>
                      </div>
                    )}
                    {gateError && <p className="text-xs text-rose-500">{gateError}</p>}
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <Link href="/settings/vault" className="text-xs text-primary hover:underline">
                        Other unlock options →
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setVaultGate(null)} className="text-xs text-muted-foreground">
                        Cancel import
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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

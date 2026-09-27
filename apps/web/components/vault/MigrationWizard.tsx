'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Download, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'

type Phase = 'inventory' | 'ready' | 'moving' | 'receipt' | 'retired'

interface CountRow {
  key: string
  label: string
  count: number
}

const RETIRED_KEY = 'momoney_server_retired_at'

export function readRetiredAt(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(RETIRED_KEY) : null
  } catch {
    return null
  }
}

function markRetired(): void {
  try {
    localStorage.setItem(RETIRED_KEY, new Date().toISOString())
  } catch {
    // ignore
  }
}

/**
 * Guided no-vault-plaintext migration: inventory → pull → encrypt → verify
 * receipt → typed-confirm retirement → deletion receipt. Plain-terms copy
 * throughout; every step gated on the last. Used in onboarding (existing
 * data) and Settings → Vault.
 */
export function MigrationWizard({ onDone }: { onDone: () => void }) {
  const vault = useVaultStore()
  const [phase, setPhase] = useState<Phase>('inventory')
  const [counts, setCounts] = useState<CountRow[]>([])
  const [progress, setProgress] = useState<{ page: number; totalPages: number } | null>(null)
  const [receipt, setReceipt] = useState<Array<{ label: string; server: number; vault: number; ok: boolean }>>([])
  const [confirmText, setConfirmText] = useState('')
  const [deletion, setDeletion] = useState<Record<string, number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('@/lib/engine/analytics-client').then(async ({ fetchServerCounts }) => {
      const rows = await fetchServerCounts().catch(() => [] as CountRow[])
      if (!cancelled) {
        setCounts(rows)
        setPhase('ready')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const totalServer = counts.reduce((a, r) => a + r.count, 0)

  const handleMove = async () => {
    setBusy(true)
    setError(null)
    try {
      const { pullAllCloudData } = await import('@/lib/engine/analytics-client')
      const { getVaultDek } = await import('@/lib/store/vault.store')
      setPhase('moving')
      const pulled = await pullAllCloudData((page, totalPages) => setProgress({ page, totalPages }))
      console.info('[migration] pulled from server:', {
        transactions: pulled.transactions.length,
        assets: pulled.assets.length,
        liabilities: pulled.liabilities.length,
        snapshots: pulled.netWorthSnapshots.length,
      })
      // Back up the pulled snapshot through the normal guarded path.
      await vault.pushEncrypted()
      // Verify: re-download, decrypt, count-compare per table.
      const { fetchVaultBlob, decryptVaultSnapshot } = await import('@/lib/engine/vault-sync')
      const fresh = await fetchVaultBlob()
      if (!fresh) throw new Error('Vault disappeared after push')
      const dek = getVaultDek()
      if (!dek) throw new Error('Vault locked unexpectedly')
      const back = await decryptVaultSnapshot(fresh, dek)
      const snap = back as unknown as Record<string, unknown[]>
      // Re-inventory at verify time: the mount-time counts may be stale (DB
      // switch, another device, re-login between steps). Comparing against
      // fresh counts keeps the receipt self-consistent by construction.
      const { fetchServerCounts: recount } = await import('@/lib/engine/analytics-client')
      const freshCounts = await recount().catch(() => [] as CountRow[])
      const freshByKey = new Map(freshCounts.map((c) => [c.key, c.count]))
      if (freshByKey.size > 0) setCounts(freshCounts)
      const byKey: Record<string, number> = {
        transactions: snap['transactions']?.length ?? 0,
        statements: snap['statements']?.length ?? 0,
        categories: snap['categories']?.length ?? 0,
        rules: snap['rules']?.length ?? 0,
        merchants: snap['merchants']?.length ?? 0,
        accounts: snap['financialAccounts']?.length ?? snap['accounts']?.length ?? 0,
        owners: snap['ownerList']?.length ?? 0,
        assets: snap['assets']?.length ?? 0,
        liabilities: snap['liabilities']?.length ?? 0,
        snapshots: snap['netWorthSnapshots']?.length ?? 0,
        invoices: snap['invoices']?.length ?? 0,
      }
      console.info('[migration] snapshot counts:', byKey)
      const rows = (freshByKey.size > 0 ? freshCounts : counts).map((c) => ({
        label: c.label,
        server: freshByKey.get(c.key) ?? c.count,
        vault: byKey[c.key] ?? 0,
        ok: (byKey[c.key] ?? 0) >= (freshByKey.get(c.key) ?? c.count),
      }))
      setReceipt(rows)
      setPhase('receipt')
      if (rows.some((r) => !r.ok)) {
        setError('Counts do not match — nothing was deleted. Retry the move; if it persists, report the table above.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
      setPhase('ready')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const handleRetire = async () => {
    if (confirmText !== 'DELETE') return
    setBusy(true)
    setError(null)
    try {
      const { apiClient } = await import('@/lib/api')
      const res = await apiClient.fetch<{ deleted: Record<string, number> }>('/v1/vault/user-data', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      setDeletion(res.deleted)
      markRetired()
      setPhase('retired')
      toast.success('Server copies deleted — vault blob only from here on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed — nothing was deleted')
    } finally {
      setBusy(false)
    }
  }

  const allOk = receipt.length > 0 && receipt.every((r) => r.ok)

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            {phase === 'retired' ? 'Migration complete' : 'Move your existing data into the vault'}
          </CardTitle>
          <CardDescription>
            Plain version: we copy everything from the readable server database into your encrypted vault,
            prove the copy is complete, and only then — with your typed permission — shred the readable originals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === 'inventory' && <p className="text-sm text-muted-foreground">Counting what&apos;s on the server…</p>}

          {(phase === 'ready' || phase === 'moving') && (
            <>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border/60">
                    {counts.map((c) => (
                      <tr key={c.key}>
                        <td className="px-4 py-2 text-foreground/90">{c.label}</td>
                        <td className="px-4 py-2 text-right font-mono">{c.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {phase === 'moving' ? (
                <div className="space-y-2">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: progress ? `${Math.min(100, (progress.page / Math.max(1, progress.totalPages)) * 100)}%` : '5%',
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progress ? `Pulling transactions (page ${progress.page} of ${progress.totalPages})…` : 'Starting…'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleMove} disabled={busy || totalServer === 0} className="gap-2">
                    <Download size={14} /> Move {totalServer.toLocaleString()} records into my vault
                  </Button>
                  <Button variant="ghost" onClick={onDone} disabled={busy}>
                    Not now
                  </Button>
                </div>
              )}
            </>
          )}

          {phase === 'receipt' && (
            <>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-4 py-2">Table</th>
                      <th className="text-right px-4 py-2">Server</th>
                      <th className="text-right px-4 py-2">Vault</th>
                      <th className="text-right px-4 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {receipt.map((r) => (
                      <tr key={r.label}>
                        <td className="px-4 py-2 text-foreground/90">{r.label}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.server.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.vault.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{r.ok ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allOk ? (
                <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
                  <p className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-300">
                    <Trash2 size={15} /> Last step: shred the readable server copies?
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your vault now holds everything above (verified). Deleting the server originals is permanent —
                    from then on only your encrypted backup exists. Type <b>DELETE</b> to confirm you understand.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type DELETE to confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="h-9 font-mono text-sm"
                    />
                    <Button
                      variant="destructive"
                      onClick={handleRetire}
                      disabled={busy || confirmText !== 'DELETE'}
                      className="shrink-0"
                    >
                      {busy ? 'Deleting…' : 'Delete server copies'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={onDone}>
                  Done for now
                </Button>
              )}
            </>
          )}

          {phase === 'retired' && deletion && (
            <>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} /> Server holds your vault blob only
                </p>
                {Object.entries(deletion).map(([table, n]) => (
                  <p key={table} className="text-xs text-muted-foreground font-mono">
                    {table}: {n} deleted
                  </p>
                ))}
              </div>
              <Button onClick={onDone} className="w-full gap-2">
                Done <ArrowRight size={14} />
              </Button>
            </>
          )}

          {error && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400 flex gap-2">
              <TriangleAlert size={14} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

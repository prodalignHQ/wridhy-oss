'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, KeyRound, Fingerprint, RefreshCw, ShieldCheck, TriangleAlert, Trash2, Database, ArrowDownToLine, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'
import { MigrationWizard, readRetiredAt } from '@/components/vault/MigrationWizard'
import { PageHelp } from '@/components/guide/PageHelp'
import { isPrfSupported, isWebAuthnAvailable } from '@/lib/engine/webauthn-prf'
import { useAuthStore } from '@/lib/store/auth.store'
import type { VaultSnapshot } from '@momoney/local-engine'

function emptySnapshot(): VaultSnapshot {
  return { transactions: [], categories: [], statements: [], owners: [], updatedAt: new Date().toISOString() }
}

function defaultDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey'
  const ua = navigator.userAgent
  const os = ua.includes('Mac') ? 'Mac' : ua.includes('Windows') ? 'Windows' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iPhone' : 'Device'
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : 'Browser'
  return `${os} · ${browser}`
}

export default function VaultPage() {
  const router = useRouter()
  const vault = useVaultStore()
  const user = useAuthStore((s) => s.user)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [mode, setMode] = useState<'password' | 'passkey' | 'recovery'>('password')
  const [prfSupported, setPrfSupported] = useState<boolean | null>(null)
  const [deviceLabel, setDeviceLabel] = useState('')
  const [chosenCredential, setChosenCredential] = useState<string | null>(null)
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultPasswordConfirm, setVaultPasswordConfirm] = useState('')
  const [pendingEdits, setPendingEdits] = useState<number | null>(null)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<{ sealed: boolean; counts: Record<string, number> | null } | null>(null)
  const [workerError, setWorkerError] = useState<string | null>(null)
  const [kdfTest, setKdfTest] = useState<null | { quick: boolean; full: boolean; quickMs: number; fullMs: number }>(null)
  const [kdfBusy, setKdfBusy] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  const [serverTotal, setServerTotal] = useState<number | null>(null)
  const [retiredAt, setRetiredAt] = useState<string | null>(null)
  const restoreFileRef = useRef<HTMLInputElement | null>(null)
  // Post-login unlock gate (?from=login): offer the escape hatch and return
  // to the dashboard after a successful unlock.
  const [fromLogin, setFromLogin] = useState(false)
  useEffect(() => {
    try {
      setFromLogin(new URLSearchParams(window.location.search).get('from') === 'login')
    } catch {
      // ignore
    }
  }, [])

  const returnAfterUnlock = () => {
    if (fromLogin) router.replace('/dashboard')
  }

  const wraps = vault.blob?.wraps ?? []

  useEffect(() => {
    let cancelled = false
    import('@/lib/engine/opfs-db').then(async ({ getPendingWork, readLastBackupAt, getLocalDbStats, getDbWorkerError }) => {
      if (cancelled) return
      const work = await getPendingWork().catch(() => ({ statements: [], edits: 0 }))
      if (cancelled) return
      setPendingEdits(work.edits + work.statements.length)
      setLastBackup(readLastBackupAt())
      const stats = await getLocalDbStats().catch(() => null)
      if (!cancelled) {
        setDbStats(stats)
        setWorkerError(getDbWorkerError())
      }
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [vault.status, vault.blob?.updatedAt])

  useEffect(() => {
    vault.refresh()
    isPrfSupported().then(setPrfSupported).catch(() => setPrfSupported(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSetup = async () => {
    if (password.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await vault.setup(password, emptySnapshot())
      setPassword('')
      setConfirm('')
      toast.success('Encrypted vault created — save your recovery code')
    } catch {
      toast.error(vault.error ?? 'Setup failed')
    }
  }

  const handleUnlockPassword = async () => {
    try {
      await vault.unlockPassword(password)
      setPassword('')
      toast.success('Vault unlocked')
      returnAfterUnlock()
    } catch {
      toast.error(vault.error ?? 'Unlock failed')
    }
  }

  const handleUnlockPasskey = async (credentialId?: string) => {
    try {
      await vault.unlockPasskey(credentialId ?? chosenCredential ?? undefined)
      toast.success('Vault unlocked with passkey')
      returnAfterUnlock()
    } catch (err) {
      const { isPasskeyCancel } = await import('@/lib/engine/webauthn-prf')
      if (isPasskeyCancel(err)) return
      toast.error(vault.error ?? 'Passkey unlock failed')
    }
  }

  const handleUnlockRecovery = async () => {
    try {
      await vault.unlockRecovery(recoveryInput)
      setRecoveryInput('')
      toast.success('Vault recovered — set a new password soon')
      returnAfterUnlock()
    } catch {
      toast.error(vault.error ?? 'Recovery failed')
    }
  }

  const handleAddPasskey = async () => {
    try {
      const label = deviceLabel.trim() || defaultDeviceLabel()
      await vault.addPasskey(user?.email ?? 'momoney-user', label)
      setDeviceLabel('')
      toast.success(`Passkey registered (${label})`)
    } catch (err) {
      const { isPasskeyCancel } = await import('@/lib/engine/webauthn-prf')
      if (isPasskeyCancel(err)) return
      toast.error(vault.error ?? 'Passkey registration failed')
    }
  }

  const handleAddPassword = async () => {
    if (vaultPassword.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    if (vaultPassword !== vaultPasswordConfirm) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await vault.addPassword(vaultPassword)
      setVaultPassword('')
      setVaultPasswordConfirm('')
      toast.success('Vault password set — new devices can join with it')
    } catch {
      toast.error(vault.error ?? 'Failed to set password')
    }
  }

  const handleRevokePasskey = async (credentialId: string, label: string) => {
    try {
      await vault.revokePasskey(credentialId)
      toast.success(`Revoked ${label} — it can no longer unlock this vault`)
    } catch {
      toast.error(vault.error ?? 'Revoke failed')
    }
  }

  const handleSync = async () => {
    try {
      await vault.pushEncrypted()
      toast.success('Encrypted snapshot synced (ciphertext only)')
    } catch {
      toast.error(vault.error ?? 'Sync failed')
    }
  }

  const refreshServerStatus = async () => {
    const [{ fetchServerCounts }, { readRetiredAt }] = await Promise.all([
      import('@/lib/engine/analytics-client'),
      import('@/components/vault/MigrationWizard'),
    ])
    const rows = await fetchServerCounts().catch(() => [])
    setServerTotal(rows.reduce((a, r) => a + r.count, 0))
    setRetiredAt(readRetiredAt())
  }

  useEffect(() => {
    if (vault.status === 'unlocked') {
      void refreshServerStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.status])

  useEffect(() => {
    setRetiredAt(readRetiredAt())
  }, [])

  const handleExportBackup = async () => {
    try {
      const { fetchVaultBlob } = await import('@/lib/engine/vault-sync')
      const blob = await fetchVaultBlob()
      if (!blob) {
        toast.error('No vault to export')
        return
      }
      const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), vault: blob }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = 'momoney-vault-backup.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Encrypted backup downloaded — keep it somewhere safe')
    } catch {
      toast.error('Export failed')
    }
  }

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { restoreVaultFromFile } = await import('@/lib/engine/vault-sync')
      await restoreVaultFromFile(file)
      await vault.refresh()
      toast.success('Vault restored from file — unlock with your original password or recovery code')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  const handleKdfTest = async () => {
    setKdfBusy(true)
    try {
      const { runKdfSelfTest } = await import('@momoney/local-engine')
      setKdfTest(await runKdfSelfTest())
    } catch {
      setKdfTest({ quick: false, full: false, quickMs: 0, fullMs: 0 })
    } finally {
      setKdfBusy(false)
    }
  }
  const handleCheckUpdates = async () => {
    try {
      const changed = await vault.pullUpdates()
      toast.success(changed ? 'Pulled changes from your other devices' : 'Already up to date')
    } catch {
      toast.error('Could not check for updates')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold text-foreground">Encrypted Vault</h1>
          <PageHelp section="vault" />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your data is encrypted on this device. The server only ever sees ciphertext.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            Status: {vault.status === 'unlocked' ? 'Unlocked' : vault.status === 'locked' ? 'Locked' : vault.status === 'no-vault' ? 'Not set up' : '…'}
          </CardTitle>
          <CardDescription>
            {vault.blob
              ? `Cipher • ${vault.blob.cipher.length.toLocaleString()} chars • Argon2id i=${vault.blob.opslimit} m=${vault.blob.memlimit} KiB • updated ${vault.blob.updatedAt ? new Date(vault.blob.updatedAt).toLocaleString() : '—'}`
              : 'No vault stored for this account yet.'}
          </CardDescription>
        </CardHeader>
        {vault.error && (
          <CardContent>
            <p className="text-sm text-rose-500">{vault.error}</p>
          </CardContent>
        )}
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database size={16} className="text-primary" />
            On-device database
          </CardTitle>
          <CardDescription>
            What this browser actually holds — the source your Transactions and Insights read when unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workerError && (
            <p className="mb-2 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 font-mono text-xs text-rose-400">
              Worker error: {workerError}
            </p>
          )}
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Key check:{' '}
              {kdfTest === null ? (
                'not run'
              ) : kdfTest.quick && kdfTest.full ? (
                <span className="font-semibold text-emerald-500">
                  healthy (quick {kdfTest.quickMs}ms, full {kdfTest.fullMs}ms)
                </span>
              ) : (
                <span className="font-semibold text-rose-500">
                  FAILED (quick {String(kdfTest.quick)}, full {String(kdfTest.full)}) — Argon2 is broken in this
                  browser; password/recovery unlock cannot work here
                </span>
              )}
            </p>
            <Button variant="outline" size="sm" onClick={handleKdfTest} disabled={kdfBusy} className="shrink-0">
              {kdfBusy ? 'Testing…' : 'Run key check'}
            </Button>
          </div>
          {dbStats === null ? (
            <p className="text-xs text-muted-foreground">Unavailable (worker/OPFS not running here).</p>
          ) : dbStats.sealed && !dbStats.counts ? (
            <p className="text-xs text-sky-400">Sealed — unlock the vault to inspect row counts.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(dbStats.counts ?? {})
                .filter(([, n]) => n > 0)
                .map(([table, n]) => (
                  <span key={table} className="rounded-full bg-muted px-2.5 py-1 font-mono">
                    {table.replace('local_', '')}: {n}
                  </span>
                ))}
              {Object.values(dbStats.counts ?? {}).every((n) => n === 0) && (
                <span className="text-muted-foreground">Empty — import a statement to fill it.</span>
              )}
              {dbStats.sealed && (
                <span className="rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25 px-2.5 py-1 font-semibold">
                  sealed file present
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {vault.status === 'no-vault' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><KeyRound size={16} /> Create vault</CardTitle>
            <CardDescription>Choose a strong password. A recovery code will be issued — write it down.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Vault password (12+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button onClick={handleSetup} disabled={vault.busy} className="w-full">
              {vault.busy ? 'Creating…' : 'Create encrypted vault'}
            </Button>
          </CardContent>
        </Card>
      )}

      {vault.recoveryCode && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <TriangleAlert size={16} /> Recovery code — shown once
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg tracking-wider select-all">{vault.recoveryCode}</p>
            <p className="text-xs text-muted-foreground mt-2">Store it offline. It is the only way back if you lose password and passkey.</p>
          </CardContent>
        </Card>
      )}

      {vault.status === 'locked' && vault.blob && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock size={16} /> Unlock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-xs">
              {( (['password', 'passkey', 'recovery'] as const).filter((m) => {
                if (m === 'password') return !!vault.blob?.wrappedDekPassword
                if (m === 'passkey') return wraps.length > 0
                return !!vault.blob?.wrappedDekRecovery
              })).map((m) => (
                <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)}>
                  {m === 'password' ? 'Password' : m === 'passkey' ? `Passkey${wraps.length > 1 ? ` (${wraps.length})` : ''}` : 'Recovery'}
                </Button>
              ))}
            </div>
            {mode === 'password' && vault.blob.wrappedDekPassword && (
              <div className="space-y-3">
                <Input type="password" placeholder="Vault password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button onClick={handleUnlockPassword} disabled={vault.busy} className="w-full">
                  <Unlock size={14} className="mr-2" /> {vault.busy ? 'Unlocking…' : 'Unlock'}
                </Button>
              </div>
            )}
            {mode === 'passkey' && wraps.length > 0 && (
              <div className="space-y-2">
                {!isWebAuthnAvailable() && <p className="text-xs text-rose-500">WebAuthn is not available in this browser.</p>}
                {prfSupported === false && <p className="text-xs text-amber-500">This browser may not support the PRF extension.</p>}
                {wraps.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Choose which device&apos;s passkey to use:</p>
                    {wraps.map((w) => (
                      <button
                        key={w.credentialId}
                        onClick={() => setChosenCredential(w.credentialId)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          (chosenCredential ?? wraps[0]?.credentialId) === w.credentialId
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-medium">{w.label}</span>
                        <span className="ml-2 text-xs opacity-70">
                          added {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <Button onClick={() => handleUnlockPasskey()} disabled={vault.busy} className="w-full">
                  <Fingerprint size={14} className="mr-2" /> {vault.busy ? 'Waiting for authenticator…' : wraps.length > 1 ? `Unlock with ${wraps.find((w) => w.credentialId === (chosenCredential ?? wraps[0]?.credentialId))?.label ?? 'passkey'}` : 'Unlock with passkey'}
                </Button>
              </div>
            )}
            {mode === 'recovery' && vault.blob.wrappedDekRecovery && (
              <div className="space-y-3">
                <Input placeholder="xxxx-xxxx-xxxx-xxxx" value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} className="font-mono" />
                <Button onClick={handleUnlockRecovery} disabled={vault.busy} className="w-full">Recover vault</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {vault.status === 'unlocked' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Unlock size={16} /> Vault open</CardTitle>
            <CardDescription>
              {vault.snapshot
                ? `${vault.snapshot.transactions.length} transactions • ${vault.snapshot.statements.length} statements cached locally`
                : 'Decrypted in memory only.'}
            </CardDescription>
            <p className="px-6 text-xs text-muted-foreground">
              Last backup:{' '}
              {lastBackup
                ? new Date(lastBackup).toLocaleString()
                : vault.blob?.updatedAt
                  ? new Date(vault.blob.updatedAt).toLocaleString()
                  : '—'}
              {pendingEdits !== null && pendingEdits > 0 && (
                <span className="ml-2 font-semibold text-amber-500">
                  • {pendingEdits} change{pendingEdits !== 1 ? 's' : ''} not yet backed up
                </span>
              )}
              {pendingEdits === 0 && <span className="ml-2 text-emerald-500">• everything backed up</span>}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={vault.busy}>
                <RefreshCw size={14} className="mr-2" /> Sync now
              </Button>
              <Button variant="outline" size="sm" onClick={handleCheckUpdates} disabled={vault.busy}>
                <ArrowDownToLine size={14} className="mr-2" /> Check for updates
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { void vault.lock() }}>
                <Lock size={14} className="mr-2" /> Lock
              </Button>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vault password
              </p>
              {vault.blob?.wrappedDekPassword ? (
                <p className="text-xs text-muted-foreground">
                  Set — new devices join with it. To change it, contact support (rotation UI is coming soon).
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No vault password yet. Without one, new devices can only join with the recovery code.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="New vault password (12+)"
                      value={vaultPassword}
                      onChange={(e) => setVaultPassword(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm"
                      value={vaultPasswordConfirm}
                      onChange={(e) => setVaultPasswordConfirm(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={handleAddPassword} disabled={vault.busy} className="shrink-0">
                      <KeyRound size={14} className="mr-2" /> Set password
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Passkeys ({wraps.length})
              </p>
              {wraps.length === 0 && (
                <p className="text-xs text-muted-foreground">No passkeys yet — add one per device for Face ID / fingerprint unlock.</p>
              )}
              {wraps.map((w) => (
                <div key={w.credentialId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{w.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      added {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokePasskey(w.credentialId, w.label)}
                    disabled={vault.busy}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Revoke
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder={`Device name (e.g. ${defaultDeviceLabel()})`}
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleAddPasskey} disabled={vault.busy || !isWebAuthnAvailable()} className="shrink-0">
                  <Fingerprint size={14} className="mr-2" /> Add this device
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {vault.status === 'unlocked' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database size={16} className="text-primary" /> Readable server data
            </CardTitle>
            <CardDescription>
              {retiredAt
                ? `Retired ${new Date(retiredAt).toLocaleString()} — the server holds your vault blob only.`
                : serverTotal === null
                  ? 'Checking what readable copies remain on the server…'
                  : serverTotal === 0
                    ? 'Nothing readable left on the server — vault blob only.'
                    : `${serverTotal.toLocaleString()} readable records still on the server.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!retiredAt && (serverTotal ?? 0) > 0 && !showMigrate && (
              <Button variant="outline" size="sm" onClick={() => setShowMigrate(true)}>
                <ShieldCheck size={14} className="mr-2" /> Secure existing server data
              </Button>
            )}
            {showMigrate && !retiredAt && (
              <MigrationWizard
                onDone={() => {
                  setShowMigrate(false)
                  void refreshServerStatus()
                  void vault.refresh()
                }}
              />
            )}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={handleExportBackup}>
                <Download size={14} className="mr-2" /> Download encrypted backup
              </Button>
              <Button variant="ghost" size="sm" onClick={() => restoreFileRef.current?.click()}>
                Restore from file
              </Button>
              <input
                ref={restoreFileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  void handleRestoreFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

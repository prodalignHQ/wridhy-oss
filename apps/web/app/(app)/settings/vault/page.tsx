'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock, KeyRound, Fingerprint, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'
import { isPrfSupported, isWebAuthnAvailable } from '@/lib/engine/webauthn-prf'
import { useAuthStore } from '@/lib/store/auth.store'
import type { VaultSnapshot } from '@momoney/local-engine'

function emptySnapshot(): VaultSnapshot {
  return { transactions: [], categories: [], statements: [], owners: [], updatedAt: new Date().toISOString() }
}

export default function VaultPage() {
  const vault = useVaultStore()
  const user = useAuthStore((s) => s.user)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [mode, setMode] = useState<'password' | 'passkey' | 'recovery'>('password')
  const [prfSupported, setPrfSupported] = useState<boolean | null>(null)

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
    } catch {
      toast.error(vault.error ?? 'Unlock failed')
    }
  }

  const handleUnlockPasskey = async () => {
    try {
      await vault.unlockPasskey()
      toast.success('Vault unlocked with passkey')
    } catch {
      toast.error(vault.error ?? 'Passkey unlock failed')
    }
  }

  const handleUnlockRecovery = async () => {
    try {
      await vault.unlockRecovery(recoveryInput)
      setRecoveryInput('')
      toast.success('Vault recovered — set a new password soon')
    } catch {
      toast.error(vault.error ?? 'Recovery failed')
    }
  }

  const handleAddPasskey = async () => {
    try {
      await vault.addPasskey(user?.email ?? 'momoney-user')
      toast.success('Passkey registered for PRF unlock')
    } catch {
      toast.error(vault.error ?? 'Passkey registration failed')
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Encrypted Vault</h1>
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
                if (m === 'passkey') return !!vault.blob?.wrappedDekPrf
                return !!vault.blob?.wrappedDekRecovery
              })).map((m) => (
                <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)}>
                  {m === 'password' ? 'Password' : m === 'passkey' ? 'Passkey' : 'Recovery'}
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
            {mode === 'passkey' && vault.blob.wrappedDekPrf && (
              <div className="space-y-2">
                {!isWebAuthnAvailable() && <p className="text-xs text-rose-500">WebAuthn is not available in this browser.</p>}
                {prfSupported === false && <p className="text-xs text-amber-500">This browser may not support the PRF extension.</p>}
                <Button onClick={handleUnlockPasskey} disabled={vault.busy} className="w-full">
                  <Fingerprint size={14} className="mr-2" /> {vault.busy ? 'Waiting for authenticator…' : 'Unlock with passkey'}
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
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={vault.busy}>
              <RefreshCw size={14} className="mr-2" /> Sync now
            </Button>
            {!vault.blob?.wrappedDekPrf && (
              <Button variant="outline" size="sm" onClick={handleAddPasskey} disabled={vault.busy || !isWebAuthnAvailable()}>
                <Fingerprint size={14} className="mr-2" /> Add passkey unlock
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { void vault.lock() }}>
              <Lock size={14} className="mr-2" /> Lock
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

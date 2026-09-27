'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Fingerprint, KeyRound, LifeBuoy, Loader2, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'
import { isWebAuthnAvailable } from '@/lib/engine/webauthn-prf'
import type { VaultBlob } from '@/lib/engine/vault-sync'

type Mode = 'pick' | 'passkey' | 'password' | 'recovery'

/**
 * Post-login unlock gate. Detects which unlock methods exist on the vault
 * and leads with the friendliest one — no jargon, no settings detour.
 * Passkey-first when available, password otherwise, recovery one tap away
 * with an explicit "not working?" escape from the passkey screen.
 */
export default function UnlockGate() {
  const router = useRouter()
  const vault = useVaultStore()
  const [blob, setBlob] = useState<VaultBlob | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('pick')
  const [password, setPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [chosenCredential, setChosenCredential] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Already unlocked (e.g. back-navigation)? Straight through.
      const { useVaultStore: store } = await import('@/lib/store/vault.store')
      if (store.getState().status === 'unlocked') {
        router.replace('/dashboard')
        return
      }
      const { fetchVaultBlob } = await import('@/lib/engine/vault-sync')
      const found = await fetchVaultBlob().catch(() => null)
      if (cancelled) return
      if (!found) {
        // No vault — onboarding owns this case.
        router.replace('/dashboard')
        return
      }
      setBlob(found)
      const wraps = found.wraps ?? []
      if (wraps.length > 0 && isWebAuthnAvailable()) {
        setMode('passkey')
        setChosenCredential(wraps[0]?.credentialId ?? '')
      } else if (found.wrappedDekPassword) {
        setMode('password')
      } else {
        setMode('recovery')
      }
      setLoading(false)
    })().catch(() => {
      if (!cancelled) {
        setLoadError('Could not reach the server. Check your connection and retry.')
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const done = () => router.replace('/dashboard')

  const doPasskey = async () => {
    setBusy(true)
    setError(null)
    try {
      await vault.unlockPasskey(chosenCredential || undefined)
      toast.success('Welcome back — your money is unlocked')
      done()
    } catch {
      setError('That did not work. Try again, or use your recovery code below — it always works.')
    } finally {
      setBusy(false)
    }
  }

  const doPassword = async () => {
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await vault.unlockPassword(password)
      setPassword('')
      toast.success('Welcome back — your money is unlocked')
      done()
    } catch {
      setError('Wrong vault password. Hint: this is your vault password, not your login password.')
    } finally {
      setBusy(false)
    }
  }

  const doRecovery = async () => {
    if (!recoveryCode.trim()) return
    setBusy(true)
    setError(null)
    try {
      await vault.unlockRecovery(recoveryCode)
      setRecoveryCode('')
      toast.success('Recovered — consider adding a fresh passkey in Settings → Vault')
      done()
    } catch {
      setError('That code did not match. It looks like xxxx-xxxx-xxxx-xxxx — check for typos.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full bg-card border-border">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Checking your vault…
        </CardContent>
      </Card>
    )
  }

  if (loadError || !blob) {
    return (
      <Card className="w-full bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Hmm, that didn&apos;t load</CardTitle>
          <CardDescription>{loadError ?? 'Something went wrong.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="ghost" onClick={() => router.replace('/dashboard')}>
            Continue without unlocking →
          </Button>
        </CardContent>
      </Card>
    )
  }

  const wraps = blob.wraps ?? []
  const hasPassword = !!blob.wrappedDekPassword
  const hasRecovery = !!blob.wrappedDekRecovery

  return (
    <Card className="w-full bg-card border-border">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockOpen size={28} />
        </div>
        <CardTitle className="text-2xl">Welcome back 👋</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          One more quick step. Logging in proved it&apos;s <b>you</b> — now open your personal safe.
          <br />
          Only this device can open it. Not us, not anyone.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === 'pick' && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
            Your vault has no unlock methods attached. Please contact support — and don&apos;t delete anything yet.
          </p>
        )}
        {mode === 'passkey' && wraps.length > 0 && (
          <div className="space-y-3">
            {wraps.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Which device is this?</p>
                {wraps.map((w) => (
                  <button
                    key={w.credentialId}
                    onClick={() => setChosenCredential(w.credentialId)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      (chosenCredential || wraps[0]?.credentialId) === w.credentialId
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-sm font-semibold">{w.label}</span>
                  </button>
                ))}
              </div>
            )}
            <Button onClick={doPasskey} disabled={busy} className="w-full h-12 text-base gap-2">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              {busy ? 'Waiting for your fingerprint…' : 'Unlock with fingerprint / Face ID'}
            </Button>
            <div className="text-center text-xs text-muted-foreground space-y-1.5">
              {hasRecovery && (
                <p>
                  Passkey not working?{' '}
                  <button onClick={() => { setMode('recovery'); setError(null) }} className="font-semibold text-primary hover:underline">
                    Use your recovery code instead →
                  </button>
                </p>
              )}
              {hasPassword && (
                <p>
                  Prefer typing?{' '}
                  <button onClick={() => { setMode('password'); setError(null) }} className="font-semibold text-primary hover:underline">
                    Use vault password →
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'password' && hasPassword && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                <KeyRound size={15} /> Your vault password
              </p>
              <Input
                type="password"
                placeholder="The password you chose for your vault"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void doPassword() }}
                className="h-11"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                This is your <b>vault</b> password, not your login password.
              </p>
            </div>
            <Button onClick={doPassword} disabled={busy || !password} className="w-full h-11">
              {busy ? 'Unlocking…' : 'Unlock my money'}
            </Button>
            <div className="text-center text-xs text-muted-foreground space-y-1.5">
              {wraps.length > 0 && isWebAuthnAvailable() && (
                <p>
                  <button onClick={() => { setMode('passkey'); setError(null) }} className="font-semibold text-primary hover:underline">
                    ← Back to fingerprint unlock
                  </button>
                </p>
              )}
              {hasRecovery && (
                <p>
                  Forgot it?{' '}
                  <button onClick={() => { setMode('recovery'); setError(null) }} className="font-semibold text-primary hover:underline">
                    Use your recovery code →
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'recovery' && hasRecovery && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                <LifeBuoy size={15} /> Your recovery code
              </p>
              <Input
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void doRecovery() }}
                className="h-11 font-mono"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                The code you saved when you set things up. This always works, even if passkeys fail.
              </p>
            </div>
            <Button onClick={doRecovery} disabled={busy || !recoveryCode.trim()} className="w-full h-11">
              {busy ? 'Checking…' : 'Recover my vault'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <button onClick={() => { setMode(wraps.length > 0 ? 'passkey' : 'password'); setError(null) }} className="font-semibold text-primary hover:underline">
                ← Back
              </button>
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-3 text-xs leading-relaxed text-rose-500">
            {error}
          </p>
        )}

        <div className="border-t border-border pt-3 text-center">
          <button onClick={() => router.replace('/dashboard')} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            Continue without unlocking (you&apos;ll see limited info) →
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

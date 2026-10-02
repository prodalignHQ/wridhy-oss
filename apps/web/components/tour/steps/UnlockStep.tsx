'use client'

// ─── Tour bridge — unlock an existing vault ──────────────────────────────────
// Only reachable on a *re-run*: setup was reopened on a vault that is
// sealed. The passkey step needs the data key in memory, so we have to open
// the vault before we can add a device to it. Deliberately minimal — the full
// unlock ceremony lives in `app/unlock`, and duplicating all of it here would
// be two places to keep honest.

import { useState } from 'react'
import { AlertCircle, Fingerprint, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'
import { isWebAuthnAvailable } from '@/lib/engine/webauthn-prf'

export function UnlockStep({ onUnlocked }: { onUnlocked: () => void }) {
  const vault = useVaultStore()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPassword = !!vault.blob?.wrappedDekPassword
  const wraps = vault.blob?.wraps ?? []
  const passkeyLabel = wraps[0]?.label

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onUnlocked()
    } catch (err) {
      // A dismissed authenticator is a "try again", never an error message.
      const { isPasskeyCancel } = await import('@/lib/engine/webauthn-prf')
      if (isPasskeyCancel(err)) return
      const stage = (err as { stage?: string }).stage
      setError(
        stage === 'derive'
          ? 'This device could not run the key check (Argon2 failed). Try another browser — your password may be fine.'
          : stage === 'unwrap'
            ? 'That did not match. This is your vault password, not your login password.'
            : (err instanceof Error ? err.message : 'Unlock failed')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound size={16} /> Unlock your vault first
        </CardTitle>
        <CardDescription className="mt-1.5 leading-relaxed">
          You already have a vault, so this is a check-up — not a reset. Open it so we can review your unlock
          methods, then we&apos;ll pick up where the dashboard left you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {passkeyLabel && isWebAuthnAvailable() && (
          <Button
            onClick={() => run(() => vault.unlockPasskey(wraps[0]?.credentialId))}
            disabled={busy}
            className="h-9 w-full"
          >
            {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Fingerprint size={14} className="mr-1.5" />}
            Unlock with {passkeyLabel}
          </Button>
        )}

        {hasPassword && (
          <>
            {passkeyLabel && isWebAuthnAvailable() && (
              <p className="text-center text-[11px] text-muted-foreground">or</p>
            )}
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password) void run(async () => vault.unlockPassword(password))
              }}
              placeholder="Your vault password"
              className="h-9"
              disabled={busy}
            />
            <Button
              variant={passkeyLabel && isWebAuthnAvailable() ? 'outline' : 'default'}
              onClick={() => run(async () => vault.unlockPassword(password))}
              disabled={busy || !password}
              className="h-9 w-full"
            >
              Unlock with password
            </Button>
          </>
        )}

        {error && (
          <p className="flex items-start gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <p className="text-center text-[11px] text-muted-foreground/70">
          Forgotten it?{' '}
          <a href="/unlock" className="font-semibold text-primary hover:underline">
            Try every unlock method →
          </a>
        </p>
      </CardContent>
    </Card>
  )
}

'use client'

// ─── Step 3 — Passkey ────────────────────────────────────────────────────────
// The daily-driver unlock. This is the one step that stays optional: a passkey
// is a per-device wrap, the vault already has a password and a recovery code,
// and plenty of authenticators cannot do PRF at all. "Not now" is a
// first-class outcome here, not a failure.

import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, Check, Fingerprint, ShieldQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TourShield } from '@/components/tour/TourBits'
import { isWebAuthnAvailable, suggestDeviceLabel } from '@/lib/engine/webauthn-prf'

/** How long the success card holds before we move on — long enough for the
 *  pop to register, short enough that it does not feel like a stall. */
const ADVANCE_DELAY_MS = 1200

export function PasskeyStep({
  onRegister,
  onContinue,
  onSkip,
  busy,
}: {
  onRegister: (label: string) => Promise<{ ok: boolean; error?: string }>
  onContinue: () => void
  onSkip: () => void
  busy: boolean
}) {
  const available = isWebAuthnAvailable()
  // Seeded lazily rather than in an effect: every step card only mounts on the
  // client (the orchestrator renders a spinner until it has loaded the blob),
  // so there is no server-rendered value to disagree with, and no cascading
  // render on mount.
  const [label, setLabel] = useState(suggestDeviceLabel)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hold the success state briefly so the animation is visible, then advance.
  useEffect(() => {
    if (!registered) return
    const timer = setTimeout(onContinue, ADVANCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [registered, onContinue])

  // Only a browser with no WebAuthn at all is a hard block. A negative PRF
  // probe is not trusted as authoritative — `isPrfSupported` documents false
  // negatives — so we let the ceremony run and surface any real failure.
  const unsupported = !available

  if (registered) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 animate-tour-pop items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 motion-reduce:animate-none">
            <Check size={26} strokeWidth={3} />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">Passkey added</h3>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            From now on this device unlocks with {label} — no typing, nothing to phish.
          </p>
          <Button onClick={onContinue} className="mt-5">
            Next: recovery code <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-start gap-4">
          <TourShield />
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Fingerprint size={16} /> Unlock with your fingerprint or face
            </CardTitle>
            <CardDescription className="mt-1.5 leading-relaxed">
              A glance or a touch opens your vault from now on. No typing.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {unsupported ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <ShieldQuestion size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {available ? 'This device can&apos;t use fingerprints' : 'This browser can&apos;t use fingerprints'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                No problem — your vault password already works. You can turn this on later from Settings.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <b className="font-semibold text-foreground">This one belongs to this device only.</b> It cannot be
                copied to your phone or another laptop — a fingerprint or a face simply does not travel.
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                On another device you sign in as usual, type your vault password, and then set up your own there.
                That is why the password above matters.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="passkey-device">
                Name this device
              </label>
              <Input
                id="passkey-device"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. MacBook, Pixel"
                className="h-9 text-sm"
                disabled={busy}
              />
            </div>

            {error && (
              <p className="flex items-start gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <Button
              onClick={async () => {
                setError(null)
                const result = await onRegister(label.trim() || 'This device')
                if (result.ok) {
                  setRegistered(true)
                } else if (result.error) {
                  // No error text means the user dismissed the authenticator
                  // prompt — return to idle quietly rather than nagging.
                  setError(result.error)
                }
              }}
              disabled={busy}
              className="h-9 w-full"
            >
              {busy ? 'Waiting for your device…' : 'Turn on fingerprint unlock'}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground/70">
              Nothing leaves this device. Your fingerprint is never sent anywhere.
            </p>
          </>
        )}

        <div className="flex gap-2">
          <Button variant={unsupported ? 'default' : 'ghost'} onClick={onSkip} disabled={busy} className="w-full">
            {unsupported ? 'Continue without a passkey' : 'Not now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

// ─── Step 2 — Vault password ─────────────────────────────────────────────────
// The anchor secret. Everything else (passkey wraps, the recovery wrap) hangs
// off the same DEK, so this is the one step we do not allow skipping. The
// requirement chips and the strength meter exist to make "12+ characters,
// and make it unlike your login" feel checkable rather than arbitrary.

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RequirementChip, TourShield } from '@/components/tour/TourBits'
import { cn } from '@/lib/utils'

export const MIN_PASSWORD_LENGTH = 12

/**
 * Cheap strength read. Length is weighted heavily on purpose: telling a user
 * that a 20-character passphrase is "Weak" is both wrong and the fastest way
 * to teach them to ignore this meter. Character variety is a bonus, not a
 * gate. Nothing here is stored or sent — it only changes four coloured bars.
 */
function scorePassword(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
  if (password.length >= 16) score++
  if (password.length >= 20) score++
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (classes >= 3) score++
  if (classes === 4) score++
  return Math.min(score, 4)
}

const STRENGTH_LABEL = ['Start typing…', 'Weak', 'Fair', 'Strong', 'Excellent']

export function PasswordStep({
  onSubmit,
  onContinue,
  busy,
  /** True when the vault already exists but has no password wrap (legacy vaults). */
  isAddingToExisting,
}: {
  onSubmit: (password: string) => Promise<{ ok: boolean; error?: string }>
  /** Advance to the next step. Not optional: the vault already exists once
   *  this resolves, so failing to unmount strands the user on a form for a
   *  vault that has their password. */
  onContinue: () => void
  busy: boolean
  isAddingToExisting?: boolean
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const score = useMemo(() => scorePassword(password), [password])
  const longEnough = password.length >= MIN_PASSWORD_LENGTH
  const matches = confirm.length > 0 && confirm === password
  const canSubmit = longEnough && matches && !busy

  const handleSubmit = async () => {
    setAttempted(true)
    if (!canSubmit) return
    setError(null)
    const result = await onSubmit(password)
    if (!result.ok) {
      setError(result.error ?? 'Could not set the vault password')
      return
    }
    // The orchestrator takes us to the next step, which unmounts this form.
    // Wipe the secret from component state on the way out so it is not sitting
    // in a React tree waiting for a devtools peek.
    setPassword('')
    setConfirm('')
    onContinue()
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-start gap-4">
          <TourShield />
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound size={16} /> Pick a vault password
            </CardTitle>
            <CardDescription className="mt-1.5 leading-relaxed">
              {isAddingToExisting
                ? 'Add one so a brand new device can join later.'
                : 'You will need this to set up your vault on a new phone or laptop, so make it something you will remember.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="Vault password (12+ characters)"
              autoComplete="new-password"
              className="h-9 pr-10"
              aria-invalid={attempted && !longEnough}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={reveal ? 'Hide password' : 'Show password'}
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Strength meter — four segments that grow as the secret improves. */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-500 ease-out',
                    i < score
                      ? score <= 1
                        ? 'bg-rose-500'
                        : score === 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] font-medium text-muted-foreground">
              {STRENGTH_LABEL[score]}
            </span>
          </div>
        </div>

        <Input
          type={reveal ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit()
          }}
          placeholder="Confirm password"
          autoComplete="new-password"
          className="h-9 font-mono text-sm"
          aria-invalid={attempted && !matches}
          disabled={busy}
        />

        <div className="flex flex-wrap gap-1.5">
          <RequirementChip label={`${MIN_PASSWORD_LENGTH}+ characters`} met={longEnough} />
          <RequirementChip label="Both match" met={matches} />
        </div>

        {attempted && !longEnough && (
          <p className="text-xs text-rose-400">
            The vault password needs at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        {attempted && longEnough && !matches && (
          <p className="text-xs text-rose-400">Those two entries do not match.</p>
        )}
        {error && (
          <p className="flex items-start gap-1.5 text-xs text-rose-400">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="font-semibold text-foreground">Two passwords, two jobs.</b> Your login password just
            proves it is you. This one opens the vault — and it is the one you type when you sign in on another
            device.
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            We never see it and cannot recover it for you. The recovery key at the end is your backup.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={busy} className="h-9 w-full">
          {busy ? 'Encrypting your vault…' : 'Create my vault'}
          {!busy && <ArrowRight size={14} className="ml-1.5" />}
        </Button>
      </CardContent>
    </Card>
  )
}

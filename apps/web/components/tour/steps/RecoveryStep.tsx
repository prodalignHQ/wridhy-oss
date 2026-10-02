'use client'

// ─── Step 4 — Recovery code ──────────────────────────────────────────────────
// The only unlock path that survives losing both the password and the device.
// Two rules shape this step: we cannot ever show the code twice (it is never
// persisted — only its wrapped form is), and we do not let anyone past the
// first-time gate without proving they wrote it down.
//
// On a *re-run* the code is gone for good, so this step becomes a verifier:
// paste the code you saved and we actually try it against the vault.

import { useState } from 'react'
import { ArrowRight, Check, Copy, TriangleAlert } from 'lucide-react'
import { normalizeRecoveryCode } from '@momoney/local-engine'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type VerifyState = 'idle' | 'checking' | 'ok' | 'bad'

export function RecoveryStep({
  code,
  /** Re-opening setup on a vault that already exists. */
  isRerun,
  serverTotal,
  onVerified,
  onVerify,
  busy,
}: {
  code: string | null
  isRerun: boolean
  serverTotal: number | null
  /** First-time: they typed the code back correctly. */
  onVerified: () => void
  /** Re-run: check a previously saved code against the live vault. */
  onVerify: (code: string) => Promise<{ ok: boolean; error?: string }>
  busy: boolean
}) {
  const [typed, setTyped] = useState('')
  const [copied, setCopied] = useState(false)
  const [verify, setVerify] = useState<VerifyState>('idle')
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const normalizedTyped = normalizeRecoveryCode(typed)
  const matches = !isRerun && code !== null && normalizedTyped === normalizeRecoveryCode(code)
  const canContinue = isRerun ? verify === 'ok' : matches

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked (insecure context, denied permission). The code is
      // select-all by default, so manual copy still works.
    }
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
          <TriangleAlert size={16} />
          {isRerun ? 'Check your recovery key works' : 'Save your recovery key'}
        </CardTitle>
        <CardDescription className="mt-1.5 leading-relaxed">
          {isRerun
            ? 'We cannot show it again — only you have it. Paste the one you saved and we will check it.'
            : 'This is the one key that gets you back in if you forget your password and lose this device. Write it down and keep it somewhere safe — we cannot show or resend it later.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isRerun && code && (
          <>
            <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-background/60 p-4">
              {/* A slow sweep across the code: reads as "handle with care"
                  without obscuring a single character. */}
              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent bg-[length:200%_100%] animate-tour-shimmer motion-reduce:animate-none"
                aria-hidden
              />
              <p className="relative select-all text-center font-mono text-lg tracking-wider text-foreground">
                {code}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={copy}
                className="relative mt-3 w-full border-amber-500/30"
              >
                {copied ? (
                  <>
                    <Check size={13} className="mr-1.5 animate-tour-pop text-emerald-500 motion-reduce:animate-none" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} className="mr-1.5" /> Copy to clipboard
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">
              Keep it on paper or in a password manager — not in a note on this device. Anyone with this key can read
              your money data.
            </p>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="recovery-confirm">
            {isRerun ? 'Paste your recovery key' : 'Type it back to finish'}
          </label>
          <Input
            id="recovery-confirm"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value)
              if (verify !== 'idle') setVerify('idle')
              setVerifyError(null)
            }}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter' || !canContinue || isRerun) return
              onVerified()
            }}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className="h-9 font-mono tracking-wider"
            aria-invalid={typed.length > 0 && !isRerun && !matches}
            disabled={busy}
          />
        </div>

        {verifyError && (
          <p className="text-xs text-rose-400">{verifyError}</p>
        )}
        {!isRerun && typed.length > 0 && !matches && (
          <p className="text-xs text-muted-foreground">
            Not quite — check the characters. Dashes are optional.
          </p>
        )}
        {isRerun && verify === 'ok' && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={13} className="animate-tour-pop motion-reduce:animate-none" strokeWidth={3} />
            That code works. You&apos;re covered.
          </p>
        )}

        {isRerun ? (
          verify === 'ok' ? (
            // A disabled "Verified" button would strand the user inside the
            // modal with no way out but Escape. Success has to hand them a
            // real exit.
            <Button onClick={onVerified} className="h-9 w-full">
              Done <ArrowRight size={14} className="ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={async () => {
                setVerify('checking')
                setVerifyError(null)
                const result = await onVerify(typed)
                if (result.ok) {
                  setVerify('ok')
                } else {
                  setVerify('bad')
                  setVerifyError(result.error ?? 'That code did not unlock your vault.')
                }
              }}
              disabled={!typed.trim() || verify === 'checking'}
              className="h-9 w-full"
            >
              {verify === 'checking' ? 'Checking…' : 'Verify code'}
              {verify !== 'checking' && <ArrowRight size={14} className="ml-1.5" />}
            </Button>
          )
        ) : (
          <Button onClick={onVerified} disabled={!canContinue} className="h-9 w-full">
            I saved it — {serverTotal && serverTotal > 0 ? 'secure my existing data' : 'open my dashboard'}
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        )}

        {!isRerun && serverTotal !== null && serverTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            You have {serverTotal.toLocaleString()} readable records on the server — next we&apos;ll move them into
            your vault, verify, and shred the originals.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

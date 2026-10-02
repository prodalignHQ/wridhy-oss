'use client'

// ─── Vault setup ─────────────────────────────────────────────────────────────
// The one place a new account meets its vault, and what users are told it is:
// "set up your vault". Order is deliberate and not negotiable: password first
// (it is the portable factor that lets a new device join), passkey second (the
// daily driver on this device), recovery key last (the one thing that must
// never be skipped or lost).
//
// Re-runnable on purpose. The dashboard sends new accounts here automatically,
// and Settings/Sidebar/dashboard link back in while there is no vault, so
// "skip for now" has to stay resumable rather than being a one-shot gate.
//
// No crypto lives here — every step delegates to the vault store or to
// vault-sync, exactly as the pre-tour onboarding did.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useVaultStore } from '@/lib/store/vault.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { useTourStore } from '@/lib/store/tour.store'
import { MigrationWizard } from '@/components/vault/MigrationWizard'
import { TourOverlay } from '@/components/tour/TourOverlay'
import { TourProgress } from '@/components/tour/TourProgress'
import { setVaultPresence } from '@/lib/use-has-vault'
import { WelcomeStep } from '@/components/tour/steps/WelcomeStep'
import { PasswordStep } from '@/components/tour/steps/PasswordStep'
import { PasskeyStep } from '@/components/tour/steps/PasskeyStep'
import { RecoveryStep } from '@/components/tour/steps/RecoveryStep'
import { UnlockStep } from '@/components/tour/steps/UnlockStep'

type StepId = 'welcome' | 'unlock' | 'password' | 'passkey' | 'recovery'

/** Header label per step. Deliberately no explanation here — the card for
 *  each step already carries one short sentence, and this is a progress
 *  indicator, not a second place to repeat ourselves. */
const STEP_META: Record<StepId, { label: string }> = {
  welcome: { label: 'Set up your vault' },
  unlock: { label: 'Unlock your vault' },
  password: { label: 'Vault password' },
  passkey: { label: 'Passkey' },
  recovery: { label: 'Recovery key' },
}

/** Result shape shared by every step callback. A missing `error` on a failed
 *  result means "nothing to report" — that is how a dismissed passkey prompt
 *  returns to idle instead of shouting at the user. */
type StepResult = { ok: boolean; error?: string }

/** Snapshot the OPFS cache into the encrypted payload for a brand-new vault. */
async function currentSnapshot() {
  const [{ readLocalCache, emptyCache }, { buildVaultSnapshot }] = await Promise.all([
    import('@/lib/engine/opfs-db'),
    import('@/lib/engine/vault-sync'),
  ])
  const cache = await readLocalCache().catch(() => null)
  return buildVaultSnapshot(cache ?? emptyCache())
}

function describeError(err: unknown, fallback: string): string {
  const code = (err as { code?: string }).code
  const stage = (err as { stage?: string }).stage
  if (code === 'PRF_UNSUPPORTED') {
    return 'This authenticator cannot derive a vault key from a passkey. Your password and recovery code still work — skip this step.'
  }
  if (stage === 'derive') {
    return 'This device could not run the key check (Argon2 failed). Try a different browser — your password may be fine.'
  }
  return err instanceof Error ? err.message : fallback
}

export function VaultTour() {
  const router = useRouter()
  const vault = useVaultStore()
  const recoveryCode = useVaultStore((s) => s.recoveryCode)

  const [plan, setPlan] = useState<StepId[] | null>(null)
  const [isRerun, setIsRerun] = useState(false)
  const [addingPassword, setAddingPassword] = useState(false)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [serverTotal, setServerTotal] = useState<number | null>(null)
  const [migrating, setMigrating] = useState(false)

  // ─── Load: what does this account actually have? ───
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Mark the tour in flight. Durable, so closing the tab mid-ceremony
      // resumes rather than restarts.
      useTourStore.getState().start()
      // The dashboard scopes the flags to the account on its way in; repeat it
      // here for anyone landing directly (Settings, sidebar, deep link). No-ops
      // when the scope already matches.
      const userId = (useAuthStore.getState().user as { id?: string } | null)?.id
      if (userId) useTourStore.getState().ensureScope(userId)

      const { fetchVaultBlob, readCachedVaultMeta } = await import('@/lib/engine/vault-sync')
      let blob = await fetchVaultBlob().catch(() => 'offline' as const)
      // Offline: unlock metadata is cached locally and is enough to plan.
      if (blob === 'offline') blob = readCachedVaultMeta()
      if (cancelled) return

      if (blob) {
        await useVaultStore.getState().refresh().catch(() => {})
        if (cancelled) return
      }

      // Re-read AFTER refresh. Holding the pre-refresh snapshot would leave
      // `blob` null on a fresh page load, and the tour would then plan itself
      // for a brand-new account: it would offer "create my vault" over an
      // existing vault, and a successful submit would PUT a brand-new DEK and
      // salt over the top, orphaning every existing passkey wrap.
      const state = useVaultStore.getState()
      const existing = state.blob
      const unlocked = state.status === 'unlocked'
      const hasPasswordWrap = !!existing?.wrappedDekPassword

      // Frozen here on purpose: `plan` must not be recomputed when the vault
      // comes into existence mid-tour, or the step indices would shift under
      // the user's feet.
      const next: StepId[] = ['welcome']
      if (existing) {
        if (!unlocked) next.push('unlock')
        if (!hasPasswordWrap) next.push('password')
      } else {
        next.push('password')
      }
      next.push('passkey', 'recovery')

      setIsRerun(!!existing)
      setAddingPassword(!!existing && !hasPasswordWrap)
      setPlan(next)
    })().catch(() => {
      if (!cancelled) {
        // Could not plan the tour (server unreachable, no cache). Rather than
        // strand them, hand back the dashboard — which owns the gating logic.
        router.replace('/dashboard')
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const step: StepId = plan?.[index] ?? 'welcome'
  const isRecovery = step === 'recovery'

  // Only worth asking once we are at the point where it changes the button.
  useEffect(() => {
    if (!isRecovery) return
    let cancelled = false
    import('@/lib/engine/analytics-client').then(async ({ fetchServerCounts }) => {
      const rows = await fetchServerCounts().catch(() => [])
      if (!cancelled) setServerTotal(rows.reduce((a, r) => a + r.count, 0))
    })
    return () => {
      cancelled = true
    }
  }, [isRecovery])

  const finish = useCallback(() => {
    useTourStore.getState().complete()
    router.replace('/dashboard')
  }, [router])

  const skip = useCallback(() => {
    useTourStore.getState().skip()
    // Keep the legacy session key in sync so any other open tab running the
    // old gate logic respects the decision immediately.
    try {
      sessionStorage.setItem('momoney_vault_onboarding_skip', '1')
    } catch {
      // private mode — the durable flag already covers us
    }
    router.replace('/dashboard')
  }, [router])

  const advance = useCallback(() => setIndex((i) => Math.min(i + 1, (plan?.length ?? 1) - 1)), [plan])

  // ─── Step callbacks ───
  const handlePassword = useCallback(async (password: string): Promise<StepResult> => {
    setBusy(true)
    try {
      const store = useVaultStore.getState()
      // Guard rail, not a style choice. `setup()` mints a brand-new DEK, salt
      // and recovery wrap. Running it against a vault that already has a
      // password wrap would replace the blob and orphan every passkey wrap the
      // user has — silent, permanent loss of their other devices' access. So
      // creating is only ever correct when there is genuinely no vault, and an
      // existing vault always gets a password *wrap* added to it.
      if (!addingPassword && store.blob?.wrappedDekPassword) {
        if (!store.isUnlocked()) {
          return { ok: false, error: 'Your vault is locked. Go back and unlock it first.' }
        }
        await store.addPassword(password)
        return { ok: true }
      }
      if (addingPassword) {
        await store.addPassword(password)
      } else {
        await store.setup(password, await currentSnapshot())
        // The "Set up your vault" entries in Settings and the sidebar exist
        // only while there is no vault — retire them without a reload.
        setVaultPresence(true)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describeError(err, 'Could not set the vault password') }
    } finally {
      setBusy(false)
    }
  }, [addingPassword])

  const handlePasskey = useCallback(async (label: string): Promise<StepResult> => {
    setBusy(true)
    try {
      const userEmail = (useAuthStore.getState().user as { email?: string } | null)?.email ?? 'momoney-user'
      await useVaultStore.getState().addPasskey(userEmail, label)
      return { ok: true }
    } catch (err) {
      const { isPasskeyCancel } = await import('@/lib/engine/webauthn-prf')
      // Dismissed or timing-rejected: silently return to idle, no error.
      if (isPasskeyCancel(err)) return { ok: false }
      return { ok: false, error: describeError(err, 'Passkey setup did not complete') }
    } finally {
      setBusy(false)
    }
  }, [])

  const handleVerifyRecovery = useCallback(async (code: string): Promise<StepResult> => {
    const { unlockWithRecovery } = await import('@/lib/engine/vault-sync')
    const blob = useVaultStore.getState().blob
    if (!blob) return { ok: false, error: 'Could not load your vault. Check your connection and retry.' }
    try {
      // Verification only. We derive the key to prove the code is right, then
      // wipe it: the live session keeps whatever DEK it already holds.
      const dek = await unlockWithRecovery(blob, code)
      dek.fill(0)
      return { ok: true }
    } catch (err) {
      const stage = (err as { stage?: string }).stage
      return {
        ok: false,
        // Don't surface the raw "Incorrect recovery code". The one fact that
        // actually helps someone who mistyped a 32-character string is that
        // codes are vault-specific, so say that instead.
        error:
          stage === 'derive'
            ? describeError(err, '')
            : 'That code does not open this vault. Recovery keys only work for the vault that issued them.',
      }
    }
  }, [])

  const handleRecoveryConfirmed = useCallback(() => {
    if ((serverTotal ?? 0) > 0) {
      setMigrating(true)
      return
    }
    finish()
  }, [serverTotal, finish])

  if (migrating) {
    return (
      <TourOverlay onDismiss={skip}>
        <div className="animate-in fade-in-0 zoom-in-95 duration-400 motion-reduce:animate-none">
          <MigrationWizard onDone={finish} />
        </div>
      </TourOverlay>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Preparing your vault…
      </div>
    )
  }

  const meta = STEP_META[step]

  return (
    // Modal on purpose: the app behind the scrim is deliberately unreachable
    // until the ceremony is finished or explicitly skipped. Wandering off to
    // invoices with no vault is exactly the outcome this prevents.
    <TourOverlay onDismiss={skip} focusKey={step}>
      <div className="space-y-4">
        {/* ─── Tour header ─── */}
        <div className="animate-in fade-in-0 slide-in-from-top-1 duration-400 motion-reduce:animate-none">
          <div className="flex items-end justify-between gap-4">
            <h1 className="truncate text-sm font-semibold text-foreground">{meta.label}</h1>
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              Step {index + 1} of {plan.length}
            </p>
          </div>
          <TourProgress steps={plan} current={index} className="mt-2.5" />
        </div>

        {/* ─── Active step ─── */}
      {/* Keyed on the step so the enter animation replays on every advance. */}
      <div
        key={step}
        className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
      >
        {step === 'welcome' && (
          <WelcomeStep busy={busy} onContinue={advance} onSkip={skip} onRestored={() => router.replace('/unlock')} />
        )}

        {step === 'unlock' && <UnlockStep onUnlocked={advance} />}

        {step === 'password' && (
          <PasswordStep
            busy={busy}
            isAddingToExisting={addingPassword}
            onSubmit={handlePassword}
            onContinue={advance}
          />
        )}

        {step === 'passkey' && (
          <PasskeyStep busy={busy} onRegister={handlePasskey} onContinue={advance} onSkip={advance} />
        )}

        {step === 'recovery' && (
          <RecoveryStep
            code={recoveryCode}
            isRerun={isRerun}
            serverTotal={serverTotal}
            busy={busy}
            onVerified={handleRecoveryConfirmed}
            onVerify={handleVerifyRecovery}
          />
        )}
      </div>

      {/* ─── Footnote ─── */}
      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground/70">
        <TriangleAlert size={12} className="mt-0.5 shrink-0" />
        {step === 'welcome'
          ? 'Everything below happens on this device. Nothing secret is sent to our servers.'
          : vault.blob
            ? `Vault #${vault.blob.salt.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)} · recovery keys only work for this vault.`
            : 'Everything below happens on this device. Nothing secret is sent to our servers.'}
      </p>
      </div>
    </TourOverlay>
  )
}

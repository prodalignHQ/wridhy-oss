// ─── Vault setup progress ────────────────────────────────────────────────────
// Durable (localStorage) on purpose. The old vault onboarding remembered a
// skip in `sessionStorage`, which meant a new tab nagged again and a skip could
// never be resumed deliberately. Persisting the status gives us:
//   • one prompt, ever — a finished setup never nags again
//   • a skip that is a real decision, not a per-tab accident
//   • a restart path that works from Settings, the sidebar or the dashboard
//
// State is keyed by account id. localStorage is per-origin, not per-account,
// so without this the first account to finish (or skip) would suppress setup
// for every other account that later signs in on the same browser.
// `history` is the source of truth; `scope` + the flat status fields are a
// projection of whichever account is currently signed in.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Route the tour lives on. Every "restart" affordance links here. */
export const TOUR_PATH = '/onboarding/vault'

export type TourStatus = 'idle' | 'running' | 'skipped' | 'completed'

interface TourFlags {
  status: TourStatus
  startedAt: number | null
  completedAt: number | null
}

const FRESH: TourFlags = { status: 'idle', startedAt: null, completedAt: null }

interface TourState extends TourFlags {
  /** Account id the flat fields currently describe. */
  scope: string
  /** Per-account flags, so switching accounts and back does not forget a skip. */
  history: Record<string, TourFlags>
  /** Adopt `scope` and project its flags. No-op when already on it. */
  ensureScope: (scope: string) => void
  /** Begin, or deliberately re-begin, the tour. */
  start: () => void
  /** Bailed at the intro: stop nudging, stay resumable. */
  skip: () => void
  /** Ceremony finished. */
  complete: () => void
  /** Forget this account's tour state so the dashboard prompts again. */
  reset: () => void
}

/** Apply a flags patch to both the live projection and the account's record. */
function write(state: TourState, patch: Partial<TourFlags>): Partial<TourState> {
  const next = { ...state, ...patch }
  return {
    ...patch,
    history: {
      ...state.history,
      [state.scope]: { status: next.status, startedAt: next.startedAt, completedAt: next.completedAt },
    },
  }
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      scope: '',
      history: {},
      status: 'idle',
      startedAt: null,
      completedAt: null,

      ensureScope: (scope) =>
        set((state) => {
          if (!scope || state.scope === scope) return state
          const flags = state.history[scope] ?? FRESH
          return {
            scope,
            status: flags.status,
            startedAt: flags.startedAt,
            completedAt: flags.completedAt,
          }
        }),

      start: () => set((state) => write(state, { status: 'running', startedAt: Date.now() })),
      skip: () => set((state) => write(state, { status: 'skipped' })),
      complete: () => set((state) => write(state, { status: 'completed', completedAt: Date.now() })),
      reset: () => set((state) => write(state, { ...FRESH })),
    }),
    {
      name: 'momoney-tour',
      // Persist the scope + the per-account map only. The flat status fields
      // are re-derived on rehydrate by the merge below.
      partialize: (state) => ({ scope: state.scope, history: state.history }),
      merge: (persisted, current) => {
        const saved = persisted as { scope?: string; history?: Record<string, TourFlags> }
        const scope = saved.scope ?? ''
        const flags = saved.history?.[scope] ?? FRESH
        return {
          ...current,
          scope,
          history: saved.history ?? {},
          status: flags.status,
          startedAt: flags.startedAt,
          completedAt: flags.completedAt,
        }
      },
    }
  )
)

// ─── Legacy skip migration ───────────────────────────────────────────────────
// Skips recorded by the pre-tour onboarding lived in `sessionStorage`. Users
// who already dismissed it should not be ambushed by the upgrade, so the
// dashboard seeds the durable flag once from that key.

const LEGACY_SKIP_KEY = 'momoney_vault_onboarding_skip'

export function readLegacySkip(): boolean {
  try {
    return sessionStorage.getItem(LEGACY_SKIP_KEY) === '1'
  } catch {
    return false
  }
}

/** Fold a legacy sessionStorage skip into the durable flag. Returns the new status. */
export function adoptLegacySkip(): TourStatus {
  if (!readLegacySkip()) return useTourStore.getState().status
  const { status, skip } = useTourStore.getState()
  if (status === 'idle' || status === 'running') skip()
  return useTourStore.getState().status
}

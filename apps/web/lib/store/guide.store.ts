// ─── Getting-started guide progress ────────────────────────────────────────
// Lightweight checklist state for /guide: which tour steps the user has
// marked done. Deliberately separate from tour.store.ts — that tracks the
// one-time vault-setup ceremony per account, this is a resumable checklist
// stored per browser.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GuideState {
  done: string[]
  /** One-time post-setup nudge ("take the guided tour?") was dismissed. */
  promptDismissed: boolean
  toggle: (stepId: string) => void
  markDone: (stepId: string) => void
  dismissPrompt: () => void
  reset: () => void
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set) => ({
      done: [],
      promptDismissed: false,
      toggle: (stepId) =>
        set((state) => ({
          done: state.done.includes(stepId)
            ? state.done.filter((id) => id !== stepId)
            : [...state.done, stepId],
        })),
      markDone: (stepId) =>
        set((state) => (state.done.includes(stepId) ? state : { done: [...state.done, stepId] })),
      dismissPrompt: () => set({ promptDismissed: true }),
      reset: () => set({ done: [] }),
    }),
    { name: 'momoney-guide' }
  )
)

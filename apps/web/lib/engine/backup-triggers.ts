// ─── Backup triggers: flush pending work on lifecycle events ────────────────
// The debounced mutation backup covers active editing, but three cases escape
// it: locking the vault, hiding/closing the tab, and coming back online.
// These listeners close those gaps. All flushes are gated on pending work
// (no pointless full-snapshot uploads) and best-effort (failures stay local
// with pending markers intact for the next trigger).
//
// beforeunload is inherently unreliable for async work (the page may die
// mid-upload) — it is a best-effort attempt, NOT a guarantee. The durable
// guarantee is OPFS itself: nothing is ever lost locally, only backup may lag.

import { flushEncryptedBackup } from './mutations'

let registered = false

export function initBackupTriggers(): void {
  if (registered || typeof window === 'undefined') return
  registered = true

  // Back online with pending work → back up now.
  window.addEventListener('online', () => {
    void flushEncryptedBackup()
  })

  // Tab hidden (switch apps, lock screen, close welds through here first) →
  // flush while the page can still run async work.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushEncryptedBackup()
    }
  })

  // Last resort before the page dies. Floating promise: the browser may or
  // may not let it finish. Pending markers survive either way.
  window.addEventListener('beforeunload', () => {
    void flushEncryptedBackup()
  })
}

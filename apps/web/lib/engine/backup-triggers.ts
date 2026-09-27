// ─── Sync triggers: push pending work, pull remote changes ─────────────────
// Push side (backup): the 5s mutation debounce covers active editing, but
// lock / tab-hide / reconnect escape it — flushEncryptedBackup closes those.
// Pull side (multi-device): another device's backup only lands here as a
// newer blob version — focus + reconnect pull it, decrypt, restore OPFS,
// and broadcast so listening pages refetch.
// All triggers are gated and best-effort; OPFS durability is the guarantee.

import { flushEncryptedBackup } from './mutations'
import { useVaultStore } from '@/lib/store/vault.store'

let registered = false

async function pullRemote(): Promise<void> {
  try {
    if (!useVaultStore.getState().isUnlocked()) return
    await useVaultStore.getState().pullUpdates()
  } catch {
    // best-effort — next trigger retries
  }
}

export function initBackupTriggers(): void {
  if (registered || typeof window === 'undefined') return
  registered = true

  // Back online: push ours first (last-writer-wins ties), then pull theirs.
  window.addEventListener('online', () => {
    void flushEncryptedBackup().finally(() => {
      void pullRemote()
    })
  })

  // Tab visible again: pull first (we may have missed versions), no push
  // (nothing could have changed locally while hidden — edits need focus).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void pullRemote()
    } else if (document.visibilityState === 'hidden') {
      void flushEncryptedBackup()
    }
  })

  // Last resort before the page dies. Floating promise: the browser may or
  // may not let it finish. Pending markers survive either way.
  window.addEventListener('beforeunload', () => {
    void flushEncryptedBackup()
  })
}

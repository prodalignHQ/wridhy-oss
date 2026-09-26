// ─── Vault-gated transaction mutations ──────────────────────────────────────
// THE rule: when the vault is unlocked, edits apply to OPFS first (instant,
// offline-capable) and back up as ciphertext later. The server PATCH/PUT
// endpoints must NOT fire — sending them would leak plaintext edits and
// diverge local state. When no vault is unlocked, callers run their legacy
// server flow (this module only implements the local side; it never calls
// the API).
//
// Every local write appends to local_changelog (table, row, op) — the future
// incremental sync (Phase 5) uploads only logged rows. A debounced encrypted
// backup follows each mutation batch.

import { useVaultStore } from '@/lib/store/vault.store'
import {
  getTransactionsFromCache,
  patchTransactionInCache,
  readLocalCache,
  setTransactionOwnersInCache,
  type OwnerShare,
} from './opfs-db'
import type { LocalTransaction } from '@momoney/local-engine'

/** True when edits must stay on-device (vault unlocked, DEK in memory). */
export function useLocalMutations(): boolean {
  try {
    return useVaultStore.getState().isUnlocked()
  } catch {
    return false
  }
}

let backupTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced ciphertext backup after local edits (5s quiet window). */
export function scheduleEncryptedBackup(): void {
  if (!useLocalMutations()) return
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    backupTimer = null
    useVaultStore
      .getState()
      .pushEncrypted()
      .catch(() => {})
  }, 5000)
}

export interface LocalCategoryRef {
  id: string
  name: string
  color: string
  icon: string | null
}

async function resolveCategory(categoryId: string | null): Promise<LocalCategoryRef | null> {
  if (!categoryId) return null
  const cache = await readLocalCache().catch(() => null)
  const found = cache?.categories.find((c) => c.id === categoryId)
  if (!found) return null
  return { id: found.id, name: found.name, color: found.color ?? '#6366f1', icon: null }
}

/** Local category assignment (single or bulk). Returns fresh rows + display category. */
export async function localSetCategory(
  ids: string[],
  categoryId: string | null
): Promise<{ rows: LocalTransaction[]; category: LocalCategoryRef | null }> {
  const unique = [...new Set(ids)]
  await Promise.all(unique.map((id) => patchTransactionInCache(id, { categoryId })))
  const [rows, category] = await Promise.all([
    getTransactionsFromCache(unique),
    resolveCategory(categoryId),
  ])
  scheduleEncryptedBackup()
  return { rows, category }
}

/** Local one-time flag (single or bulk). */
export async function localSetOneTime(ids: string[], isOneTime: boolean): Promise<{ rows: LocalTransaction[] }> {
  const unique = [...new Set(ids)]
  await Promise.all(unique.map((id) => patchTransactionInCache(id, { isOneTime })))
  const rows = await getTransactionsFromCache(unique)
  scheduleEncryptedBackup()
  return { rows }
}

/** Local owner assignment with equal split (single or bulk). */
export async function localSetOwners(
  ids: string[],
  ownerIds: string[]
): Promise<{ rows: LocalTransaction[]; sharesByTxn: Record<string, OwnerShare[]> }> {
  const unique = [...new Set(ids)]
  const sharesByTxn: Record<string, OwnerShare[]> = {}
  await Promise.all(
    unique.map(async (id) => {
      const shares = await setTransactionOwnersInCache(id, ownerIds)
      sharesByTxn[id] = shares ?? []
    })
  )
  const rows = await getTransactionsFromCache(unique)
  scheduleEncryptedBackup()
  return { rows, sharesByTxn }
}

'use client'

import { create } from 'zustand'
import type { VaultSnapshot } from '@momoney/local-engine'
import {
  addPasswordWrap,
  decryptVaultSnapshot,
  fetchVaultBlob,
  registerPasskey,
  revokePasskey,
  setupVaultWithPassword,
  syncEncryptedSnapshot,
  syncSnapshot,
  unlockWithPasskey,
  unlockWithPassword,
  unlockWithRecovery,
  type VaultBlob,
} from '../engine/vault-sync'
import { sealLocalDb, unsealLocalDb, readChangelog, clearChangelog, markBackupComplete, hasPendingWork, restoreSnapshotToCache, emptyCache } from '../engine/opfs-db'

// ─── In-memory vault session ─────────────────────────────────────────────────
// DEK lives here only. Locking wipes it. Nothing key-related is persisted.

interface VaultState {
  status: 'unknown' | 'locked' | 'unlocked' | 'no-vault'
  blob: VaultBlob | null
  snapshot: VaultSnapshot | null
  recoveryCode: string | null
  error: string | null
  busy: boolean
  refresh: () => Promise<void>
  setup: (password: string, snapshot: VaultSnapshot) => Promise<void>
  /** Adopt an already-created session (e.g. passkey-first onboarding). */
  adoptSession: (blob: VaultBlob, dek: Uint8Array, snapshot: VaultSnapshot, recoveryCode: string | null) => void
  unlockPassword: (password: string) => Promise<void>
  unlockPasskey: (credentialId?: string) => Promise<void>
  unlockRecovery: (code: string) => Promise<void>
  addPasskey: (userName: string, label: string) => Promise<void>
  revokePasskey: (credentialId: string) => Promise<void>
  /** Set the vault password on a vault that lacks one (early passkey-only vaults). */
  addPassword: (password: string) => Promise<void>
  sync: (snapshot: VaultSnapshot) => Promise<void>
  lock: () => Promise<void>
  clearError: () => void
  /** True when the vault is unlocked and the DEK is in memory. */
  isUnlocked: () => boolean
  /**
   * Encrypted backup: snapshot the OPFS cache, encrypt with the in-memory
   * DEK, and POST the ciphertext to /v1/vault/sync (version-guarded).
   */
  pushEncrypted: () => Promise<void>
  /**
   * Pull remote changes: if the server blob version is newer than ours,
   * decrypt with the in-memory DEK, restore into OPFS, and broadcast
   * `momoney:vault-updated` so listening pages refetch. Returns true when
   * anything changed. Requires unlocked (DEK must be present to decrypt).
   */
  pullUpdates: () => Promise<boolean>
}

// Module-scoped DEK — outside React state so it never serializes anywhere.
let dek: Uint8Array | null = null

export function getVaultDek(): Uint8Array | null {
  return dek
}

function wipeBytes(b: Uint8Array | null) {
  if (b) b.fill(0)
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'unknown',
  blob: null,
  snapshot: null,
  recoveryCode: null,
  error: null,
  busy: false,

  refresh: async () => {
    set({ busy: true, error: null })
    try {
      const blob = await fetchVaultBlob()
      if (!blob) {
        set({ status: 'no-vault', blob: null })
      } else if (dek) {
        const snapshot = await decryptVaultSnapshot(blob, dek)
        set({ status: 'unlocked', blob, snapshot })
      } else {
        set({ status: 'locked', blob, snapshot: null })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load vault' })
    } finally {
      set({ busy: false })
    }
  },

  setup: async (password, snapshot) => {
    set({ busy: true, error: null })
    try {
      const { blob, recoveryCode, dek: newDek } = await setupVaultWithPassword(password, snapshot)
      wipeBytes(dek)
      dek = newDek
      set({ status: 'unlocked', blob, snapshot, recoveryCode })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Vault setup failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  unlockPassword: async (password) => {
    let { blob } = get()
    if (!blob) {
      // Self-heal: actions must work even if no screen refreshed the store
      // yet (fresh login lands here directly). Without this, unlock throws
      // 'No vault loaded', which UIs misreport as wrong password/code.
      await get().refresh().catch(() => {})
      blob = get().blob
    }
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithPassword(blob, password)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
      // New device / fresh profile: seed OPFS from the snapshot so every
      // OPFS-reading page works immediately. Idempotent elsewhere.
      await restoreSnapshotToCache(snapshot).catch(() => {})
      wipeBytes(dek)
      dek = newDek
      set({ status: 'unlocked', snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unlock failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  unlockPasskey: async (credentialId) => {
    let { blob } = get()
    if (!blob) {
      // Self-heal: actions must work even if no screen refreshed the store
      // yet (fresh login lands here directly). Without this, unlock throws
      // 'No vault loaded', which UIs misreport as wrong password/code.
      await get().refresh().catch(() => {})
      blob = get().blob
    }
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithPasskey(blob, credentialId)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
      // New device / fresh profile: seed OPFS from the snapshot so every
      // OPFS-reading page works immediately. Idempotent elsewhere.
      await restoreSnapshotToCache(snapshot).catch(() => {})
      wipeBytes(dek)
      dek = newDek
      set({ status: 'unlocked', snapshot })
    } catch (err) {
      // Dismissed prompts are not errors — leave state clean, rethrow for
      // callers that distinguish, and let UIs return to idle silently.
      const { isPasskeyCancel } = await import('../engine/webauthn-prf')
      if (!isPasskeyCancel(err)) {
        set({ error: err instanceof Error ? err.message : 'Passkey unlock failed' })
      }
      throw err
    } finally {
      set({ busy: false })
    }
  },

  unlockRecovery: async (code) => {
    let { blob } = get()
    if (!blob) {
      // Self-heal: actions must work even if no screen refreshed the store
      // yet (fresh login lands here directly). Without this, unlock throws
      // 'No vault loaded', which UIs misreport as wrong password/code.
      await get().refresh().catch(() => {})
      blob = get().blob
    }
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithRecovery(blob, code)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
      // New device / fresh profile: seed OPFS from the snapshot so every
      // OPFS-reading page works immediately. Idempotent elsewhere.
      await restoreSnapshotToCache(snapshot).catch(() => {})
      wipeBytes(dek)
      dek = newDek
      set({ status: 'unlocked', snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Recovery failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  addPasskey: async (userName, label) => {
    const { blob } = get()
    if (!blob || !dek) throw new Error('Vault must be unlocked to add a passkey')
    set({ busy: true, error: null })
    try {
      const updated = await registerPasskey(blob, dek, userName, label)
      set({ blob: updated })
    } catch (err) {
      const { isPasskeyCancel } = await import('../engine/webauthn-prf')
      if (!isPasskeyCancel(err)) {
        set({ error: err instanceof Error ? err.message : 'Passkey registration failed' })
      }
      throw err
    } finally {
      set({ busy: false })
    }
  },

  revokePasskey: async (credentialId) => {
    let { blob } = get()
    if (!blob) {
      // Self-heal: actions must work even if no screen refreshed the store
      // yet (fresh login lands here directly). Without this, unlock throws
      // 'No vault loaded', which UIs misreport as wrong password/code.
      await get().refresh().catch(() => {})
      blob = get().blob
    }
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const updated = await revokePasskey(blob, credentialId)
      set({ blob: updated })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to revoke passkey' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  addPassword: async (password) => {
    const { blob } = get()
    if (!blob || !dek) throw new Error('Vault must be unlocked to set a password')
    set({ busy: true, error: null })
    try {
      const updated = await addPasswordWrap(blob, dek, password)
      set({ blob: updated })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to set password' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  sync: async (snapshot) => {
    const { blob } = get()
    if (!blob || !dek) throw new Error('Vault must be unlocked to sync')
    set({ busy: true, error: null })
    try {
      const updated = await syncSnapshot(blob, dek, snapshot)
      set({ blob: updated, snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Sync failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  isUnlocked: () => get().status === 'unlocked' && dek !== null,

  pushEncrypted: async () => {
    const { blob } = get()
    if (!blob || !dek) throw new Error('Vault must be unlocked to back up')
    set({ busy: true, error: null })
    try {
      const [{ readLocalCache }, { buildVaultSnapshot }] = await Promise.all([
        import('../engine/opfs-db'),
        import('../engine/vault-sync'),
      ])
      // Capture the changelog mark BEFORE snapshotting: entries written
      // during the build belong to the next backup, not this one.
      const log = await readChangelog().catch(() => [])
      const maxId = log.reduce((m, e) => Math.max(m, e.id), 0)
      const cache = await readLocalCache()
      // Empty cache still syncs (records the version; keeps backup fresh).
      const snapshot = buildVaultSnapshot(cache ?? emptyCache())
      const updated = await syncEncryptedSnapshot(blob, dek, snapshot)
      if (maxId > 0) await clearChangelog(maxId).catch(() => {})
      markBackupComplete()
      set({ blob: updated, snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Encrypted backup failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  adoptSession: (blob, newDek, snapshot, recoveryCode) => {
    wipeBytes(dek)
    dek = newDek
    set({ status: 'unlocked', blob, snapshot, recoveryCode, error: null, busy: false })
  },

  pullUpdates: async () => {
    const { blob } = get()
    if (!blob || !dek) return false
    const fresh = await fetchVaultBlob().catch(() => null)
    if (!fresh || fresh.version <= blob.version) return false
    // Newer ciphertext exists: decrypt with our in-memory DEK (same DEK —
    // versions share it until rotation lands) and restore into OPFS.
    const snapshot = await decryptVaultSnapshot(fresh, dek).catch(() => null)
    if (!snapshot) return false
    const { restoreSnapshotToCache } = await import('../engine/opfs-db')
    await restoreSnapshotToCache(snapshot).catch(() => {})
    set({ blob: fresh, snapshot })
    try {
      window.dispatchEvent(new CustomEvent('momoney:vault-updated'))
    } catch {
      // non-DOM runtimes (tests) — ignore
    }
    return true
  },

  lock: async () => {
    // Flush pending edits FIRST (needs the DEK), so lock never drops an
    // un-backed-up change. Best-effort: failures stay local with markers.
    try {
      if (dek && (await hasPendingWork().catch(() => false))) {
        await get().pushEncrypted()
      }
    } catch {
      // ignore — seal + wipe below are the guarantee
    }
    // Seal the OPFS database file BEFORE wiping the DEK, so a locked device
    // holds ciphertext only. Best-effort: lock always completes.
    try {
      if (dek) await sealLocalDb(dek)
    } catch {
      // ignore — in-memory wipe below is the guarantee
    }
    wipeBytes(dek)
    dek = null
    set({ status: 'locked', snapshot: null, recoveryCode: null, error: null })
  },

  clearError: () => set({ error: null }),
}))

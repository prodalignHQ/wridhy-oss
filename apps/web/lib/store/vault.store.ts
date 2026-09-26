'use client'

import { create } from 'zustand'
import type { VaultSnapshot } from '@momoney/local-engine'
import {
  decryptVaultSnapshot,
  fetchVaultBlob,
  registerPasskey,
  setupVaultWithPassword,
  syncEncryptedSnapshot,
  syncSnapshot,
  unlockWithPasskey,
  unlockWithPassword,
  unlockWithRecovery,
  type VaultBlob,
} from '../engine/vault-sync'
import { sealLocalDb, unsealLocalDb } from '../engine/opfs-db'

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
  unlockPassword: (password: string) => Promise<void>
  unlockPasskey: () => Promise<void>
  unlockRecovery: (code: string) => Promise<void>
  addPasskey: (userName: string) => Promise<void>
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
    const { blob } = get()
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithPassword(blob, password)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
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

  unlockPasskey: async () => {
    const { blob } = get()
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithPasskey(blob)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
      wipeBytes(dek)
      dek = newDek
      set({ status: 'unlocked', snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Passkey unlock failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  unlockRecovery: async (code) => {
    const { blob } = get()
    if (!blob) throw new Error('No vault loaded')
    set({ busy: true, error: null })
    try {
      const newDek = await unlockWithRecovery(blob, code)
      await unsealLocalDb(newDek).catch(() => {})
      const snapshot = await decryptVaultSnapshot(blob, newDek)
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

  addPasskey: async (userName) => {
    const { blob } = get()
    if (!blob || !dek) throw new Error('Vault must be unlocked to add a passkey')
    set({ busy: true, error: null })
    try {
      const updated = await registerPasskey(blob, dek, userName)
      set({ blob: updated })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Passkey registration failed' })
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
      const cache = await readLocalCache()
      // Empty cache still syncs (records the version; keeps backup fresh).
      const snapshot = buildVaultSnapshot(
        cache ?? {
          transactions: [], categories: [], statements: [], accounts: [], owners: [],
          transactionOwners: [], rules: [], merchants: [], invoices: [],
          invoiceStatements: [], invoiceItems: [],
        }
      )
      const updated = await syncEncryptedSnapshot(blob, dek, snapshot)
      set({ blob: updated, snapshot })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Encrypted backup failed' })
      throw err
    } finally {
      set({ busy: false })
    }
  },

  lock: async () => {    // Seal the OPFS database file BEFORE wiping the DEK, so a locked device
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

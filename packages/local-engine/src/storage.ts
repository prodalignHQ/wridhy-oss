// ─── Storage interface — OPFS/SQLCipher seam ────────────────────────────────
// Phase 1 implements an IndexedDB-backed store with the same interface the
// future SQLCipher/OPFS implementation will expose. The analytics engine only
// depends on this interface, so swapping the backend is a one-file change.
//
// Future SQLCipher backend: replace `createIndexedDbVault()` with
// `createSqlCipherVault(dek)` using wa-sqlite + OPFS. Row shapes stay identical.

import type { VaultSnapshot } from './types.js'
export type { VaultSnapshot } from './types.js'

export interface LocalVault {
  save(snapshot: VaultSnapshot): Promise<void>
  load(): Promise<VaultSnapshot | null>
  clear(): Promise<void>
}

const DB_NAME = 'momoney-vault'
const STORE = 'snapshot'
const KEY = 'v1'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function createIndexedDbVault(): LocalVault {
  return {
    async save(snapshot: VaultSnapshot) {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({ ...snapshot, updatedAt: new Date().toISOString() }, KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    async load() {
      const db = await openDb()
      const result = await new Promise<VaultSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(KEY)
        req.onsuccess = () => resolve((req.result as VaultSnapshot | undefined) ?? null)
        req.onerror = () => reject(req.error)
      })
      db.close()
      return result
    },
    async clear() {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
  }
}

// ─── Encrypted-vault placeholder ─────────────────────────────────────────────
// Phase 2 (Argon2id + WebAuthn PRF + SQLCipher) will implement:
//   createEncryptedVault({ dek, cipherBlob, transport })
// The server-side counterpart is an opaque blob table. Suggested Postgres
// schema for your new test schema (you said you'll bring one up):
//
//   create table vault_blobs (
//     user_id uuid primary key references users(id) on delete cascade,
//     cipher bytea not null,            -- XChaCha20-Poly1305(SQLite file or JSON snapshot)
//     wrapped_dek bytea not null,       -- DEK wrapped by KEK (Argon2id) or PRF output
//     wrap_mode text not null,          -- 'password' | 'webauthn-prf'
//     salt bytea not null,              -- Argon2id salt
//     version int not null default 1,
//     updated_at timestamptz not null default now()
//   );
//
// Client encrypts locally, uploads only `cipher` + wrap metadata. Server never
// sees plaintext transactions.

export const VAULT_SCHEMA_SQL = `-- see comment above for vault_blobs DDL`

// ─── Encrypted OPFS SQLite engine (dedicated Worker) ────────────────────────
// wa-sqlite sync build + OriginPrivateFileSystemVFS. OPFS sync access handles
// only work in a dedicated Worker — never the main thread.
//
// At-rest story (Phase 2): the live `momoney.db` OPFS file is sealed with the
// vault DEK (XChaCha20-Poly1305) on lock and unsealed on unlock, so a locked
// device holds ciphertext only. Page-level encryption (SQLite3MC custom
// wa-sqlite build, `PRAGMA key`) is the follow-up and drops into openDb()
// without changing this protocol.

import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite/src/sqlite-api.js'
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js'
import { sealBytes, unsealBytes } from '@momoney/local-engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sqlite3 = any

const DB_NAME = 'momoney.db'
const SEALED_NAME = 'momoney.db.sealed'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS local_transactions(
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  statement_id TEXT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount TEXT NOT NULL,
  type TEXT NOT NULL,
  is_one_time INTEGER NOT NULL DEFAULT 0,
  category_id TEXT,
  comment TEXT,
  dedup_hash TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS local_statements(
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  statement_month TEXT NOT NULL,
  parsed_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS local_categories(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  type TEXT NOT NULL DEFAULT 'expense'
);
CREATE INDEX IF NOT EXISTS idx_local_txn_date ON local_transactions(date);
CREATE INDEX IF NOT EXISTS idx_local_txn_account ON local_transactions(account_id);
`

let sqlite3: Sqlite3 | null = null
let db: number | null = null

async function openDb(): Promise<void> {
  if (db !== null) return
  const module = await SQLiteESMFactory({
    locateFile: (file: string) => `/${file}`,
  })
  sqlite3 = SQLite.Factory(module)
  const vfs = new OriginPrivateFileSystemVFS()
  await sqlite3.vfs_register(vfs, false)
  db = await sqlite3.open_v2(
    DB_NAME,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    'opfs'
  )
  await sqlite3.exec(db, SCHEMA)
}

async function closeDb(): Promise<void> {
  if (sqlite3 && db !== null) {
    try {
      await sqlite3.close(db)
    } catch {
      // already closed
    }
    db = null
  }
}

async function opfsFile(name: string, create: boolean) {
  const root = await navigator.storage.getDirectory()
  return root.getFileHandle(name, { create })
}

/** Copy into a fresh ArrayBuffer-backed view (DOM write APIs reject SharedArrayBuffer-backed views). */
function toArrayBufferView(u8: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
  return new Uint8Array(buf)
}

export interface DbWorkerRequest {
  id: number
  op: 'init' | 'upsert' | 'readAll' | 'clear' | 'seal' | 'unseal' | 'sealedExists'
  payload?: unknown
}

export interface DbWorkerResponse {
  id: number
  ok: boolean
  rows?: Record<string, unknown>[]
  sealed?: boolean
  error?: string
}

interface UpsertPayload {
  transactions: Array<Record<string, unknown>>
  categories: Array<Record<string, unknown>>
  statements: Array<Record<string, unknown>>
}

async function handle(req: DbWorkerRequest): Promise<Omit<DbWorkerResponse, 'id'>> {
  switch (req.op) {
    case 'init': {
      await openDb()
      return { ok: true }
    }
    case 'upsert': {
      await openDb()
      const p = req.payload as UpsertPayload
      const queries: string[] = []
      const params: unknown[][] = []
      const txnSql = `INSERT INTO local_transactions(id,account_id,statement_id,date,description,merchant,amount,type,is_one_time,category_id,comment,dedup_hash)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,statement_id=excluded.statement_id,date=excluded.date,
          description=excluded.description,merchant=excluded.merchant,amount=excluded.amount,type=excluded.type,
          is_one_time=excluded.is_one_time,category_id=excluded.category_id,comment=excluded.comment,dedup_hash=excluded.dedup_hash`
      for (const t of p.transactions) {
        queries.push(txnSql)
        params.push([
          t['id'], t['accountId'], t['statementId'], t['date'], t['description'], t['merchant'],
          t['amount'], t['type'], t['isOneTime'] ? 1 : 0, t['categoryId'], t['comment'], t['dedupHash'],
        ])
      }
      const catSql = `INSERT INTO local_categories(id,name,color,type) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,type=excluded.type`
      for (const c of p.categories) {
        queries.push(catSql)
        params.push([c['id'], c['name'], c['color'], c['type']])
      }
      const stmtSql = `INSERT INTO local_statements(id,account_id,bank_id,statement_month,parsed_count,imported_count,duplicates_skipped)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,bank_id=excluded.bank_id,
          statement_month=excluded.statement_month,parsed_count=excluded.parsed_count,
          imported_count=excluded.imported_count,duplicates_skipped=excluded.duplicates_skipped`
      for (const s of p.statements) {
        queries.push(stmtSql)
        params.push([s['id'], s['accountId'], s['bankId'], s['statementMonth'], s['parsedCount'], s['importedCount'], s['duplicatesSkipped']])
      }
      if (queries.length > 0) await sqlite3.executeBatch(db, queries, params)
      return { ok: true }
    }
    case 'readAll': {
      await openDb()
      const zip = (res: { rows: unknown[][]; columns: string[] }) =>
        res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])) as Record<string, unknown>)
      const transactions = zip(await sqlite3.execWithParams(db, 'SELECT * FROM local_transactions', null))
      const categories = zip(await sqlite3.execWithParams(db, 'SELECT * FROM local_categories', null))
      const statements = zip(await sqlite3.execWithParams(db, 'SELECT * FROM local_statements', null))
      return { ok: true, rows: [{ transactions, categories, statements }] }
    }
    case 'clear': {
      await openDb()
      await sqlite3.exec(db, 'DELETE FROM local_transactions; DELETE FROM local_statements; DELETE FROM local_categories;')
      return { ok: true }
    }
    case 'seal': {
      const { dek } = req.payload as { dek: Uint8Array }
      await closeDb()
      const root = await navigator.storage.getDirectory()
      const handle = await opfsFile(DB_NAME, false).catch(() => null)
      if (!handle) return { ok: true }
      const file = await handle.getFile()
      const plain = new Uint8Array(await file.arrayBuffer())
      const env = sealBytes(plain, dek)
      dek.fill(0)
      const sealedHandle = await opfsFile(SEALED_NAME, true)
      const writable = await sealedHandle.createWritable()
      await writable.write(JSON.stringify({ v: 1, nonce: env.nonceB64, cipher: env.cipherB64 }))
      await writable.close()
      await root.removeEntry(DB_NAME)
      return { ok: true }
    }
    case 'unseal': {
      const { dek } = req.payload as { dek: Uint8Array }
      const sealedHandle = await opfsFile(SEALED_NAME, false).catch(() => null)
      if (!sealedHandle) return { ok: true }
      const file = await sealedHandle.getFile()
      const env = JSON.parse(await file.text()) as { nonce: string; cipher: string }
      const plain = unsealBytes(env.cipher, env.nonce, dek)
      dek.fill(0)
      const dbHandle = await opfsFile(DB_NAME, true)
      const writable = await dbHandle.createWritable()
      await writable.write(toArrayBufferView(plain))
      await writable.close()
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(SEALED_NAME)
      await openDb()
      return { ok: true }
    }
    case 'sealedExists': {
      const sealedHandle = await opfsFile(SEALED_NAME, false).catch(() => null)
      return { ok: true, sealed: !!sealedHandle }
    }
    default:
      throw new Error(`Unknown db op`)
  }
}

self.onmessage = async (e: MessageEvent<DbWorkerRequest>) => {
  const { id } = e.data
  try {
    const res = await handle(e.data)
    self.postMessage({ id, ...res } satisfies DbWorkerResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'DB worker failed' } satisfies DbWorkerResponse)
  }
}

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
import {
  OPFS_CLEAR_SQL,
  OPFS_READ_TABLES,
  OPFS_SCHEMA,
  buildClearChangelog,
  buildDeleteByIds,
  buildDeleteByStatement,
  buildDeleteInvoice,
  buildDeleteInvoiceItems,
  buildPatchTransaction,
  buildRewriteInvoiceLinks,
  buildSetInvoiceStatus,
  buildSetOwners,
  buildUpsertBatch,
  sealBytes,
  unsealBytes,
  type LocalInvoiceCreate,
  type TxnPatch,
} from '@momoney/local-engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sqlite3 = any

const DB_NAME = 'momoney.db'
const SEALED_NAME = 'momoney.db.sealed'

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
  // Never shadow a sealed database with a fresh empty one: if the sealed
  // file exists but the live file is gone, the vault is locked — creating
  // momoney.db here would make reads return empty and let later upserts
  // fork the data. Unlock (unseal) must happen first.
  const root = await navigator.storage.getDirectory()
  const names: string[] = []
  try {
    for await (const entry of (root as unknown as { values(): AsyncIterable<{ name: string }> }).values()) {
      names.push(entry.name)
    }
  } catch {
    // listing unsupported — proceed; unseal path still guards decrypt errors
  }
  if (!names.includes(DB_NAME) && names.includes(SEALED_NAME)) {
    throw new Error('SEALED: database is locked — unlock the vault first')
  }
  db = await sqlite3.open_v2(
    DB_NAME,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    'opfs'
  )
  await sqlite3.exec(db, OPFS_SCHEMA)
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
  op: 'init' | 'upsert' | 'readAll' | 'clear' | 'deleteByStatement' | 'deleteByIds' | 'patchTransaction' | 'setOwners' | 'getByIds' | 'getChangelog' | 'clearChangelog' | 'rewriteInvoiceLinks' | 'deleteInvoice' | 'deleteInvoiceItems' | 'setInvoiceStatus' | 'stats' | 'seal' | 'unseal' | 'sealedExists'
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
  transactions?: Array<Record<string, unknown>>
  categories?: Array<Record<string, unknown>>
  statements?: Array<Record<string, unknown>>
  accounts?: Array<Record<string, unknown>>
  owners?: Array<Record<string, unknown>>
  transactionOwners?: Array<Record<string, unknown>>
  rules?: Array<Record<string, unknown>>
  merchants?: Array<Record<string, unknown>>
  invoices?: Array<Record<string, unknown>>
  invoiceStatements?: Array<Record<string, unknown>>
  invoiceItems?: Array<Record<string, unknown>>
}async function handle(req: DbWorkerRequest): Promise<Omit<DbWorkerResponse, 'id'>> {
  switch (req.op) {
    case 'init': {
      await openDb()
      return { ok: true }
    }
    case 'upsert': {
      await openDb()
      const batch = buildUpsertBatch((req.payload ?? {}) as UpsertPayload)
      if (batch.queries.length > 0) await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'readAll': {
      await openDb()
      const zip = (res: { rows: unknown[][]; columns: string[] }) =>
        res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])) as Record<string, unknown>)
      const out: Record<string, Record<string, unknown>[]> = {}
      for (const table of OPFS_READ_TABLES) {
        out[table] = zip(await sqlite3.execWithParams(db, `SELECT * FROM ${table}`, null))
      }
      const rows = [
        {
          transactions: out['local_transactions'],
          categories: out['local_categories'],
          statements: out['local_statements'],
          accounts: out['local_accounts'],
          owners: out['local_owners'],
          transactionOwners: out['local_transaction_owners'],
          rules: out['local_rules'],
          merchants: out['local_merchants'],
          invoices: out['local_invoices'],
          invoiceStatements: out['local_invoice_statements'],
          invoiceItems: out['local_invoice_items'],
        },
      ]
      return { ok: true, rows }
    }
    case 'deleteByStatement': {
      await openDb()
      const { statementId } = req.payload as { statementId: string }
      const batch = buildDeleteByStatement(statementId)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'deleteByIds': {
      await openDb()
      const { ids } = req.payload as { ids: string[] }
      const batch = buildDeleteByIds(ids)
      if (batch.queries.length > 0) await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'patchTransaction': {
      await openDb()
      const { id, patch } = req.payload as { id: string; patch: TxnPatch }
      const batch = buildPatchTransaction(id, patch)
      if (batch.queries.length > 0) await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'setOwners': {
      await openDb()
      const { transactionId, ownerIds } = req.payload as { transactionId: string; ownerIds: string[] }
      const found = await sqlite3.execWithParams(db, 'SELECT amount FROM local_transactions WHERE id = ?', [transactionId])
      const amount = found.rows?.[0]?.[0] as string | undefined
      if (amount === undefined) throw new Error('Transaction not found in local cache')
      const batch = buildSetOwners(transactionId, ownerIds, String(amount))
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      // Return resolved shares (names/colors) for instant UI updates.
      const placeholders = ownerIds.map(() => '?').join(',')
      const ownersRes = await sqlite3.execWithParams(
        db,
        `SELECT id, name, color, is_default FROM local_owners WHERE id IN (${placeholders})`,
        ownerIds
      )
      const n = ownerIds.length
      const shareAmount = (parseFloat(String(amount)) / n).toFixed(2)
      const sharePct = (100 / n).toFixed(2)
      const byId = new Map(
        (ownersRes.rows as unknown[][]).map((r) => [
          String(r[0]),
          { name: String(r[1]), color: r[2] as string | null, isDefault: Number(r[3]) === 1 },
        ])
      )
      const rows = ownerIds.map((oid) => {
        const o = byId.get(oid) ?? { name: 'Unknown', color: null, isDefault: false }
        return { ownerId: oid, name: o.name, color: o.color, isDefault: o.isDefault, amount: shareAmount, percentage: sharePct }
      })
      return { ok: true, rows }
    }
    case 'getByIds': {
      await openDb()
      const { ids } = req.payload as { ids: string[] }
      if (ids.length === 0) return { ok: true, rows: [] }
      const placeholders = ids.map(() => '?').join(',')
      const res = await sqlite3.execWithParams(db, `SELECT * FROM local_transactions WHERE id IN (${placeholders})`, ids)
      const zipped = (res.rows as unknown[][]).map((r) =>
        Object.fromEntries((res.columns as string[]).map((c, i) => [c, r[i]]))
      )
      return { ok: true, rows: zipped as Record<string, unknown>[] }
    }
    case 'getChangelog': {
      await openDb()
      const res = await sqlite3.execWithParams(db, 'SELECT id, table_name, row_id, op, created_at FROM local_changelog ORDER BY id', null)
      const rows = (res.rows as unknown[][]).map((r) => ({
        id: r[0] as number,
        table: r[1] as string,
        rowId: r[2] as string,
        op: r[3] as string,
        createdAt: r[4] as number,
      }))
      return { ok: true, rows: rows as unknown as Record<string, unknown>[] }
    }
    case 'clearChangelog': {
      await openDb()
      const { upToId } = req.payload as { upToId: number }
      const batch = buildClearChangelog(upToId)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'rewriteInvoiceLinks': {
      await openDb()
      const { invoiceId, statements } = req.payload as {
        invoiceId: string
        statements: LocalInvoiceCreate['statements']
      }
      const batch = buildRewriteInvoiceLinks(invoiceId, statements)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'deleteInvoice': {
      await openDb()
      const { invoiceId } = req.payload as { invoiceId: string }
      const batch = buildDeleteInvoice(invoiceId)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'deleteInvoiceItems': {
      await openDb()
      const { invoiceId } = req.payload as { invoiceId: string }
      const batch = buildDeleteInvoiceItems(invoiceId)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'setInvoiceStatus': {
      await openDb()
      const { invoiceId, status, generatedAt } = req.payload as {
        invoiceId: string
        status: 'draft' | 'generated'
        generatedAt: string | null
      }
      const batch = buildSetInvoiceStatus(invoiceId, status, generatedAt)
      await sqlite3.executeBatch(db, batch.queries, batch.params)
      return { ok: true }
    }
    case 'clear': {
      await openDb()
      await sqlite3.exec(db, OPFS_CLEAR_SQL)
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
    case 'stats': {
      // No openDb() here on purpose: when sealed we must report sealed:true
      // instead of creating an empty database (see openDb guard).
      const root = await navigator.storage.getDirectory()
      const liveHandle = await opfsFile(DB_NAME, false).catch(() => null)
      const sealedHandle = await opfsFile(SEALED_NAME, false).catch(() => null)
      if (!liveHandle) {
        return { ok: true, sealed: !!sealedHandle, rows: [] }
      }
      await openDb()
      const counts: Record<string, number> = {}
      for (const table of OPFS_READ_TABLES) {
        try {
          const res = await sqlite3.execWithParams(db, `SELECT COUNT(*) AS n FROM ${table}`, null)
          counts[table] = (res.rows?.[0]?.[0] as number) ?? 0
        } catch {
          counts[table] = -1
        }
      }
      void root
      return { ok: true, sealed: !!sealedHandle, rows: [counts as unknown as Record<string, unknown>] }
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

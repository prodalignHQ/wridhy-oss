// ─── Encrypted OPFS SQLite engine (dedicated Worker) ────────────────────────
// wa-sqlite ASYNC build (Asyncify) + OriginPrivateFileSystemVFS. The async
// build is REQUIRED: the OPFS VFS methods are async (file-handle acquisition
// cannot be synchronous), and the sync build coerces their returned Promises
// to ints — open "succeeds" while registration is still pending, then every
// xRead hits an empty file map ('filename' of undefined). Same Factory API,
// same call sites; ~2x the WASM bytes, no COOP/COEP needed.

import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
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

// Per-user database files: OPFS is origin-scoped, not account-scoped, so
// sharing one file across accounts would merge everyone's rows (local tables
// carry no userId). The client re-scopes on every call; the worker keeps one
// open handle and switches files on change. `null` (signed out) uses the
// legacy shared file.
let currentUser: string | null | undefined = undefined

function sanitizeUserId(userId: string | null): string {
  if (!userId) return ''
  return userId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
}

function dbFileName(): string {
  const suffix = sanitizeUserId(currentUser ?? null)
  return suffix ? `momoney-${suffix}.db` : DB_NAME
}

function sealedFileName(): string {
  return `${dbFileName()}.sealed`
}

// WASM module, bootable two ways:
// 1. Preferred: main thread fetches /wa-sqlite.wasm (it has a real origin)
//    and posts the bytes via the `boot` op → instantiate with `wasmBinary`,
//    no fetch inside the worker at all.
// 2. Fallback: locateFile load (works when the worker has a resolvable base
//    URL, e.g. production same-origin workers). Blob-URL workers (dev) fail
//    here with "Failed to parse URL" — hence path 1.
let modulePromise: Promise<unknown> | null = null

async function getModule(): Promise<unknown> {
  if (!modulePromise) {
    modulePromise = SQLiteAsyncESMFactory({
      locateFile: (file: string) => `/${file}`,
    })
  }
  return modulePromise
}

let opening: Promise<void> | null = null

async function openDb(): Promise<void> {
  if (db !== null) return
  // Serialize: concurrent calls share one open. A second Factory() +
  // vfs_register() pair throws 'already registered' and leaves stale VFS
  // file maps behind (the xRead/xLock 'filename' crashes). Single-threaded
  // assignment here is atomic, so this is race-free.
  if (!opening) {
    opening = doOpen().finally(() => {
      opening = null
    })
  }
  await opening
  if (db === null) throw new Error('Database open failed')
}

async function doOpen(): Promise<void> {
  const module = await getModule()
  // Singleton API object + single VFS registration for the worker lifetime.
  if (!sqlite3) {
    sqlite3 = SQLite.Factory(module)
    const vfs = new OriginPrivateFileSystemVFS()
    await sqlite3.vfs_register(vfs, false)
  }
  try {
    await tryOpen()
  } catch (err) {
    db = null
    // SEALED is routine locked-state, not corruption: no quarantine, just
    // propagate (callers fall back; unlock unseals). Quarantining here used
    // to log scary NotFoundErrors on every locked read.
    if (err instanceof Error && err.message.startsWith('SEALED:')) throw err
    // A failed open must never leave a stuck handle (that produced the
    // permanent "no such table" state). Quarantine the suspect file so a
    // corrupt leftover can't wedge us again, then retry once on fresh.
    await quarantineDbFile().catch(() => {})
    await tryOpen()
  }
}

async function tryOpen(): Promise<void> {
  // Never shadow a sealed database with a fresh empty one: if the sealed
  // file exists but the live file is gone, the vault is locked — creating
  // the live file here would make reads return empty and let later upserts
  // fork the data. Unlock (unseal) must happen first.
  const live = dbFileName()
  const sealed = sealedFileName()
  const root = await navigator.storage.getDirectory()
  const names: string[] = []
  try {
    for await (const entry of (root as unknown as { values(): AsyncIterable<{ name: string }> }).values()) {
      names.push(entry.name)
    }
  } catch {
    // listing unsupported — proceed; unseal path still guards decrypt errors
  }
  if (!names.includes(live) && names.includes(sealed)) {
    throw new Error('SEALED: database is locked — unlock the vault first')
  }
  // Assign db ONLY after the handle validates (open + schema + probe).
  // Assigning earlier left a stuck non-null handle on failed opens, making
  // every later call skip recovery and fail with "no such table" forever.
  const handle = await sqlite3.open_v2(
    dbFileName(),
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    'opfs'
  )
  try {
    await sqlite3.exec(handle, OPFS_SCHEMA)
    await sqlite3.exec(handle, 'SELECT count(*) FROM local_transactions')
  } catch (err) {
    try {
      await sqlite3.close(handle)
    } catch {
      // ignore close errors on a broken handle
    }
    throw err
  }
  db = handle
}

/**
 * Rename a suspect database out of the way (never silently delete user
 * data). Called when open fails — e.g. a corrupt leftover from earlier
 * buggy runs. The sealed file and vault blob remain the recovery sources.
 */
async function quarantineDbFile(): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const live = dbFileName()
  const name = `${live}.corrupt-${Date.now()}`
  try {
    const handle = await root.getFileHandle(live)
    const file = await handle.getFile()
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.length === 0) {
      await root.removeEntry(live)
      return
    }
    const dest = await root.getFileHandle(name, { create: true })
    const writable = await dest.createWritable()
    await writable.write(toArrayBufferView(bytes))
    await writable.close()
    await root.removeEntry(live)
    console.warn(`[db.worker] quarantined suspect database as ${name} (${bytes.length} bytes)`)
  } catch (err) {
    console.warn('[db.worker] quarantine failed:', err)
    throw err
  }
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
  op: 'boot' | 'setUser' | 'init' | 'upsert' | 'readAll' | 'clear' | 'deleteByStatement' | 'deleteByIds' | 'patchTransaction' | 'setOwners' | 'getByIds' | 'getChangelog' | 'clearChangelog' | 'rewriteInvoiceLinks' | 'deleteInvoice' | 'deleteInvoiceItems' | 'setInvoiceStatus' | 'stats' | 'seal' | 'unseal' | 'sealedExists'
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
    case 'boot': {
      const { wasm } = req.payload as { wasm: ArrayBuffer }
      // Emscripten instantiates from memory — no fetch, no URL resolution.
      modulePromise = SQLiteAsyncESMFactory({ wasmBinary: new Uint8Array(wasm) })
      await modulePromise
      return { ok: true }
    }
    case 'setUser': {
      const { userId } = req.payload as { userId: string | null }
      if (userId !== currentUser) {
        await closeDb()
        currentUser = userId ?? null
      }
      return { ok: true }
    }
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
          assets: out['local_assets'],
          liabilities: out['local_liabilities'],
          netWorthSnapshots: out['local_networth_snapshots'],
          netWorthDrafts: out['local_networth_drafts'],
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
      const live = dbFileName()
      const sealed = sealedFileName()
      const handle = await opfsFile(live, false).catch(() => null)
      if (!handle) return { ok: true }
      const file = await handle.getFile()
      const plain = new Uint8Array(await file.arrayBuffer())
      const env = sealBytes(plain, dek)
      dek.fill(0)
      const sealedHandle = await opfsFile(sealed, true)
      const writable = await sealedHandle.createWritable()
      await writable.write(JSON.stringify({ v: 1, nonce: env.nonceB64, cipher: env.cipherB64 }))
      await writable.close()
      await root.removeEntry(live)
      return { ok: true }
    }
    case 'unseal': {
      const { dek } = req.payload as { dek: Uint8Array }
      const live = dbFileName()
      const sealed = sealedFileName()
      const sealedHandle = await opfsFile(sealed, false).catch(() => null)
      if (!sealedHandle) return { ok: true }
      const file = await sealedHandle.getFile()
      const env = JSON.parse(await file.text()) as { nonce: string; cipher: string }
      const plain = unsealBytes(env.cipher, env.nonce, dek)
      dek.fill(0)
      const dbHandle = await opfsFile(live, true)
      const writable = await dbHandle.createWritable()
      await writable.write(toArrayBufferView(plain))
      await writable.close()
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(sealed)
      await openDb()
      return { ok: true }
    }
    case 'sealedExists': {
      const sealedHandle = await opfsFile(sealedFileName(), false).catch(() => null)
      return { ok: true, sealed: !!sealedHandle }
    }
    case 'stats': {
      // No openDb() here on purpose: when sealed we must report sealed:true
      // instead of creating an empty database (see openDb guard).
      const liveHandle = await opfsFile(dbFileName(), false).catch(() => null)
      const sealedHandle = await opfsFile(sealedFileName(), false).catch(() => null)
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
      return { ok: true, sealed: !!sealedHandle, rows: [counts as unknown as Record<string, unknown>] }
    }
    default:
      throw new Error(`Unknown db op`)
  }
}

// Serialized: every op runs to completion before the next starts. Without
// this, a read racing seal's close (or two concurrent opens) corrupts VFS
// state and produces the xRead/xLock 'filename' crashes.
let opQueue: Promise<void> = Promise.resolve()

self.onmessage = (e: MessageEvent<DbWorkerRequest>) => {
  const { id } = e.data
  opQueue = opQueue.then(async () => {
    try {
      const res = await handle(e.data)
      self.postMessage({ id, ...res } satisfies DbWorkerResponse)
    } catch (err) {
      self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'DB worker failed' } satisfies DbWorkerResponse)
    }
  })
}

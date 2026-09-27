// ─── OPFS SQLite client (main-thread facade) ────────────────────────────────
// All SQLite work happens in workers/db.worker.ts (OPFS sync handles require
// a dedicated Worker). This module is a thin promise-based facade with
// graceful degradation: every op returns null/false when Workers/OPFS are
// unavailable, and callers fall back to the cloud API.

import type { DbWorkerRequest, DbWorkerResponse } from '@/workers/db.worker'
import { OPFS_SCHEMA_VERSION } from '@momoney/local-engine'
import type {
  LocalAsset,
  LocalCategory,
  LocalFinancialAccount,
  LocalInvoice,
  LocalInvoiceItem,
  LocalInvoiceStatement,
  LocalLiability,
  LocalMerchant,
  LocalNetWorthDraft,
  LocalNetWorthSnapshot,
  LocalOwner,
  LocalRule,
  LocalStatement,
  LocalTransaction,
  LocalTransactionOwner,
  VaultSnapshot,
} from '@momoney/local-engine'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: DbWorkerResponse) => void; reject: (e: Error) => void }>()

// Resolves once the worker has instantiated SQLite. The WASM bytes are
// fetched on the MAIN thread (real document origin) and transferred in —
// the worker itself must never fetch, because bundlers may serve it from a
// blob: URL where relative fetches cannot resolve.
let bootPromise: Promise<void> | null = null
let cachedWasm: ArrayBuffer | null = null

async function fetchWasmBytes(): Promise<ArrayBuffer> {
  if (!cachedWasm) {
    const res = await fetch('/wa-sqlite-async.wasm')
    if (!res.ok) throw new Error(`wa-sqlite-async.wasm HTTP ${res.status} — is apps/web/public/wa-sqlite-async.wasm being served?`)
    cachedWasm = await res.arrayBuffer()
  }
  return cachedWasm
}

function bootWorker(w: Worker): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const wasm = await fetchWasmBytes()
      const id = ++seq
      await new Promise<DbWorkerResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id)
            reject(new Error('DB worker boot timeout'))
          }
        }, 30_000)
        // Transfer (not copy): the worker gets the bytes, this side keeps
        // the cached original for future restarts.
        const copy = wasm.slice(0)
        w.postMessage({ id, op: 'boot', payload: { wasm: copy } }, [copy])
      }).then((res) => {
        if (!res.ok) throw new Error(res.error ?? 'DB worker boot failed')
      })
      // Schema handshake: a stale worker chunk (aggressive Turbopack dev
      // caching) would otherwise ignore new tables silently — every
      // upsert "succeeds" while new tables stay empty. Fail loudly instead.
      const pingId = ++seq
      const version = await new Promise<number>((resolve, reject) => {
        pending.set(pingId, {
          resolve: (res) => {
            const v = (res.rows?.[0] as { version?: unknown } | undefined)?.version
            if (typeof v === 'number') resolve(v)
            else reject(new Error('DB worker did not report a schema version'))
          },
          reject,
        })
        setTimeout(() => {
          if (pending.has(pingId)) {
            pending.delete(pingId)
            reject(new Error('DB worker version check timeout'))
          }
        }, 15_000)
        w.postMessage({ id: pingId, op: 'ping', payload: {} } satisfies DbWorkerRequest)
      })
      if (version !== OPFS_SCHEMA_VERSION) {
        throw new Error(
          `On-device engine outdated (worker schema v${version}, expected v${OPFS_SCHEMA_VERSION}) — hard-refresh (Cmd+Shift+R) to update it`
        )
      }
    })()
    bootPromise.catch(() => {
      bootPromise = null
    })
  }
  return bootPromise
}

// Last worker failure, human-readable. Surfaced in Settings → Vault →
// diagnostics so users can paste it into a bug report instead of guessing.
let lastWorkerError: string | null = null

export function getDbWorkerError(): string | null {
  return lastWorkerError
}

function noteError(message: string): void {
  lastWorkerError = message
  console.warn(`[opfs-db] ${message}`)
}

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  try {
    if (!worker) {
      worker = new Worker(new URL('../../workers/db.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<DbWorkerResponse>) => {
        const entry = pending.get(e.data.id)
        if (!entry) return
        pending.delete(e.data.id)
        entry.resolve(e.data)
      }
      worker.onerror = () => {
        noteError('worker crashed on startup (bundling/serve failure?)')
        for (const [, entry] of pending) entry.reject(new Error('DB worker error'))
        pending.clear()
        bootPromise = null
        scopedUser = undefined
        try {
          worker?.terminate()
        } catch {
          // ignore
        }
        worker = null
      }
    }
    return worker
  } catch {
    return null
  }
}

async function call(op: DbWorkerRequest['op'], payload?: unknown, timeoutMs = 30_000): Promise<DbWorkerResponse | null> {
  const w = getWorker()
  if (!w) {
    noteError('Workers unavailable in this browser/context')
    return null
  }
  try {
    await bootWorker(w)
    await ensureUserScope()
  } catch (err) {
    noteError(`boot failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
  const id = ++seq
  const promise = new Promise<DbWorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error('DB worker timeout'))
      }
    }, timeoutMs)
  })
  const req: DbWorkerRequest = { id, op, payload }
  // Uint8Array (DEK) transfers by copy via structured clone; worker wipes its copy.
  w.postMessage(req)
  try {
    const res = await promise
    if (!res.ok) throw new Error(res.error ?? 'DB op failed')
    lastWorkerError = null
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // SEALED is routine locked-state operation, not a malfunction: debug
    // level, and never promoted to the diagnostics error line.
    if (message.includes('SEALED:')) {
      console.debug(`[opfs-db] ${op} skipped: ${message}`)
      return null
    }
    noteError(`${op} failed: ${message}`)
    return null
  }
}

// ─── Per-user database scoping ───────────────────────────────────────────────
// OPFS is origin-scoped, NOT account-scoped: two accounts in one browser
// profile would otherwise read and write each other's rows (local tables
// carry no userId). Every worker call re-scopes to the signed-in user first;
// the worker keeps one open handle and switches files on change.
let scopedUser: string | null | undefined = undefined

async function currentAuthUserId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    // Dynamic import: auth.store never imports this module back, so no cycle;
    // module is cached after first load, so this is just a promise hop.
    const { useAuthStore } = await import('@/lib/store/auth.store')
    const user = useAuthStore.getState().user as { id?: string } | null
    return user?.id ?? null
  } catch {
    return null
  }
}

async function ensureUserScope(): Promise<void> {
  const userId = await currentAuthUserId()
  if (userId === scopedUser) return
  const w = worker
  if (!w) return
  const id = ++seq
  const res = await new Promise<DbWorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error('DB setUser timeout'))
      }
    }, 15_000)
    w.postMessage({ id, op: 'setUser', payload: { userId } } satisfies DbWorkerRequest)
  }).catch(() => null)
  if (!res?.ok) throw new Error(res?.error ?? 'DB setUser failed')
  scopedUser = userId
}

export interface LocalCache {
  transactions: LocalTransaction[]
  categories: LocalCategory[]
  statements: LocalStatement[]
  accounts: LocalFinancialAccount[]
  owners: LocalOwner[]
  transactionOwners: LocalTransactionOwner[]
  rules: LocalRule[]
  merchants: LocalMerchant[]
  invoices: LocalInvoice[]
  invoiceStatements: LocalInvoiceStatement[]
  invoiceItems: LocalInvoiceItem[]
  assets: LocalAsset[]
  liabilities: LocalLiability[]
  netWorthSnapshots: LocalNetWorthSnapshot[]
  netWorthDrafts: LocalNetWorthDraft[]
}

export type LocalCachePatch = Partial<LocalCache>

/** Canonical empty cache (keeps every consumer complete by construction). */
export function emptyCache(): LocalCache {
  return {
    transactions: [],
    categories: [],
    statements: [],
    accounts: [],
    owners: [],
    transactionOwners: [],
    rules: [],
    merchants: [],
    invoices: [],
    invoiceStatements: [],
    invoiceItems: [],
    assets: [],
    liabilities: [],
    netWorthSnapshots: [],
    netWorthDrafts: [],
  }
}

interface RawBundle {
  transactions: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  statements: Record<string, unknown>[]
  accounts?: Record<string, unknown>[]
  owners?: Record<string, unknown>[]
  transactionOwners?: Record<string, unknown>[]
  rules?: Record<string, unknown>[]
  merchants?: Record<string, unknown>[]
  invoices?: Record<string, unknown>[]
  invoiceStatements?: Record<string, unknown>[]
  invoiceItems?: Record<string, unknown>[]
  assets?: Record<string, unknown>[]
  liabilities?: Record<string, unknown>[]
  netWorthSnapshots?: Record<string, unknown>[]
  netWorthDrafts?: Record<string, unknown>[]
}

function rowToTransaction(r: Record<string, unknown>): LocalTransaction {
  return {
    id: String(r['id']),
    accountId: String(r['account_id']),
    statementId: (r['statement_id'] as string | null) ?? null,
    date: String(r['date']).slice(0, 10),
    description: String(r['description']),
    merchant: (r['merchant'] as string | null) ?? null,
    amount: String(r['amount']),
    type: r['type'] === 'credit' ? 'credit' : 'debit',
    isOneTime: Number(r['is_one_time']) === 1,
    categoryId: (r['category_id'] as string | null) ?? null,
    comment: (r['comment'] as string | null) ?? null,
    dedupHash: String(r['dedup_hash'] ?? ''),
  }
}

export function mapCacheRowToTransaction(r: Record<string, unknown>): LocalTransaction {
  return rowToTransaction(r)
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

/** Cache server rows into OPFS. Fire-and-forget safe (returns false on failure). */
export async function cacheServerRows(cache: LocalCachePatch): Promise<boolean> {
  const res = await call('upsert', cache, 60_000)
  return !!res?.ok
}

/**
 * Restore a decrypted vault snapshot into OPFS (new device / fresh profile).
 * Upserts are idempotent, so running this on the originating device is a
 * harmless no-op merge. Without this, unlock on a new device decrypts into
 * memory only and every OPFS-reading page stays empty.
 */
export async function restoreSnapshotToCache(snapshot: VaultSnapshot): Promise<boolean> {
  return cacheServerRows({
    transactions: snapshot.transactions ?? [],
    categories: snapshot.categories ?? [],
    statements: snapshot.statements ?? [],
    accounts: snapshot.financialAccounts ?? [],
    owners: snapshot.ownerList ?? [],
    transactionOwners: snapshot.owners ?? [],
    rules: snapshot.rules ?? [],
    merchants: snapshot.merchants ?? [],
    invoices: snapshot.invoices ?? [],
    invoiceStatements: snapshot.invoiceStatements ?? [],
    invoiceItems: snapshot.invoiceItems ?? [],
  })
}

/** Read the full local cache. Null when unavailable or empty. */
export async function readLocalCache(): Promise<LocalCache | null> {
  const res = await call('readAll', undefined, 30_000)
  const bundle = res?.rows?.[0] as RawBundle | undefined
  if (!bundle || bundle.transactions.length === 0) return null
  return {
    transactions: bundle.transactions.map(rowToTransaction),
    categories: (bundle.categories ?? []).map((c) => ({
      id: String(c['id']),
      name: String(c['name']),
      color: (c['color'] as string | null) ?? null,
      type: (c['type'] as LocalCategory['type']) ?? 'expense',
    })),
    statements: (bundle.statements ?? []).map((s) => ({
      id: String(s['id']),
      accountId: String(s['account_id']),
      bankId: String(s['bank_id']),
      statementMonth: String(s['statement_month']),
      parsedCount: Number(s['parsed_count'] ?? 0),
      importedCount: Number(s['imported_count'] ?? 0),
      duplicatesSkipped: Number(s['duplicates_skipped'] ?? 0),
    })),
    accounts: (bundle.accounts ?? []).map((a) => ({
      id: String(a['id']),
      accountName: String(a['account_name']),
      accountType: String(a['account_type']),
      bankId: String(a['bank_id']),
      bankName: String(a['bank_name']),
      currency: String(a['currency'] ?? 'INR'),
    })),
    owners: (bundle.owners ?? []).map((o) => ({
      id: String(o['id']),
      name: String(o['name']),
      notes: (o['notes'] as string | null) ?? null,
      color: String(o['color'] ?? 'indigo'),
      isDefault: Number(o['is_default']) === 1,
    })),
    transactionOwners: (bundle.transactionOwners ?? []).map((t) => ({
      transactionId: String(t['transaction_id']),
      ownerId: String(t['owner_id']),
      amount: String(t['amount']),
      percentage: String(t['percentage']),
    })),
    rules: (bundle.rules ?? []).map((r) => ({
      id: String(r['id']),
      userId: (r['user_id'] as string | null) ?? null,
      matchField: r['match_field'] as LocalRule['matchField'],
      matchType: r['match_type'] as LocalRule['matchType'],
      matchValue: String(r['match_value']),
      categoryId: String(r['category_id']),
      priority: Number(r['priority'] ?? 500),
      source: (r['source'] as LocalRule['source']) ?? 'user',
      isActive: Number(r['is_active']) !== 0,
    })),
    merchants: (bundle.merchants ?? []).map((m) => ({
      id: String(m['id']),
      userId: (m['user_id'] as string | null) ?? null,
      rawPatterns: parseJsonArray(m['raw_patterns']),
      normalizedName: String(m['normalized_name']),
      defaultCategoryId: (m['default_category_id'] as string | null) ?? null,
      isSystem: Number(m['is_system']) === 1,
    })),
    invoices: (bundle.invoices ?? []).map((v) => ({
      id: String(v['id']),
      name: String(v['name']),
      status: v['status'] === 'generated' ? 'generated' : 'draft',
      invoiceMonth: String(v['invoice_month']),
      generatedAt: (v['generated_at'] as string | null) ?? null,
    })),
    invoiceStatements: (bundle.invoiceStatements ?? []).map((v) => ({
      invoiceId: String(v['invoice_id']),
      statementId: (v['statement_id'] as string | null) ?? null,
      accountId: (v['account_id'] as string | null) ?? null,
      statementMonth: String(v['statement_month']),
      accountName: String(v['account_name']),
      accountType: String(v['account_type']),
    })),
    invoiceItems: (bundle.invoiceItems ?? []).map((v) => ({
      id: String(v['id']),
      invoiceId: String(v['invoice_id']),
      transactionId: (v['transaction_id'] as string | null) ?? null,
      statementId: (v['statement_id'] as string | null) ?? null,
      date: String(v['date']).slice(0, 10),
      description: String(v['description']),
      amount: String(v['amount']),
      type: v['type'] === 'credit' ? 'credit' : 'debit',
      isOneTime: Number(v['is_one_time']) === 1,
      categoryId: (v['category_id'] as string | null) ?? null,
      categoryName: String(v['category_name'] ?? 'Uncategorized'),
      categoryColor: (v['category_color'] as string | null) ?? null,
      categoryType: String(v['category_type'] ?? 'expense'),
      owners: Array.isArray(v['owners'])
        ? (v['owners'] as LocalCache['invoiceItems'][number]['owners'])
        : (() => {
            try {
              return JSON.parse(String(v['owners'] ?? '[]')) as LocalCache['invoiceItems'][number]['owners']
            } catch {
              return []
            }
          })(),
    })),
    assets: (bundle.assets ?? []).map((v) => ({
      id: String(v['id']),
      ownerId: (v['owner_id'] as string | null) ?? null,
      name: String(v['name'] ?? ''),
      type: String(v['type'] ?? 'other'),
      value: String(v['value'] ?? '0'),
      currency: String(v['currency'] ?? 'INR'),
      equityDebtTag: (v['equity_debt_tag'] as string | null) ?? null,
      metadata: parseJsonObject(v['metadata']),
      valuationDate: String(v['valuation_date'] ?? '').slice(0, 10),
      createdAt: String(v['created_at'] ?? ''),
      updatedAt: String(v['updated_at'] ?? ''),
    })),
    liabilities: (bundle.liabilities ?? []).map((v) => ({
      id: String(v['id']),
      ownerId: (v['owner_id'] as string | null) ?? null,
      name: String(v['name'] ?? ''),
      type: String(v['type'] ?? 'other'),
      outstandingAmount: String(v['outstanding_amount'] ?? '0'),
      interestRate: (v['interest_rate'] as string | null) ?? null,
      monthlyPayment: (v['monthly_payment'] as string | null) ?? null,
      lastUpdated: String(v['last_updated'] ?? '').slice(0, 10),
      createdAt: String(v['created_at'] ?? ''),
    })),
    netWorthSnapshots: (bundle.netWorthSnapshots ?? []).map((v) => ({
      id: String(v['id']),
      ownerId: (v['owner_id'] as string | null) ?? null,
      snapshotDate: String(v['snapshot_date'] ?? '').slice(0, 10),
      totalAssets: String(v['total_assets'] ?? '0'),
      totalLiabilities: String(v['total_liabilities'] ?? '0'),
      netWorth: String(v['net_worth'] ?? '0'),
      assetBreakdown: parseJsonNullableArray(v['asset_breakdown']) as LocalNetWorthSnapshot['assetBreakdown'],
      liabilityBreakdown: parseJsonNullableArray(v['liability_breakdown']) as LocalNetWorthSnapshot['liabilityBreakdown'],
      notes: (v['notes'] as string | null) ?? null,
      createdAt: String(v['created_at'] ?? ''),
    })),
    netWorthDrafts: (bundle.netWorthDrafts ?? []).map((v) => ({
      id: String(v['id']),
      ownerId: (v['owner_id'] as string | null) ?? null,
      assetBreakdown: parseJsonNullableArray(v['asset_breakdown']) as Array<Record<string, unknown>> | null,
      liabilityBreakdown: parseJsonNullableArray(v['liability_breakdown']) as Array<Record<string, unknown>> | null,
      savedAt: String(v['saved_at'] ?? ''),
    })),
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // fall through
    }
  }
  return {}
}

function parseJsonNullableArray(value: unknown): Array<Record<string, unknown>> | Array<{ name: string; type: string; value: number; equityDebtTag?: string }> | Array<{ name: string; type: string; amount: number }> | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null
    } catch {
      return null
    }
  }
  return null
}

/** Remove a statement and its transactions from the cache (after server delete). */
export async function deleteStatementFromCache(statementId: string): Promise<boolean> {
  const res = await call('deleteByStatement', { statementId })
  return !!res?.ok
}

/** Remove superseded local rows by id (dedupHash convergence after sync). */
export async function deleteTransactionsFromCache(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true
  const res = await call('deleteByIds', { ids })
  return !!res?.ok
}

/** Delete one reference/net-worth row by id (allowlisted tables only). */
export async function deleteRowFromCache(table: string, id: string): Promise<boolean> {
  const res = await call('deleteRow', { table, id })
  return !!res?.ok
}

/** Reassign all shares from one owner to another (owner delete mirror). */
export async function reassignOwnersInCache(fromOwnerId: string, toOwnerId: string): Promise<boolean> {
  const res = await call('reassignOwners', { fromOwnerId, toOwnerId })
  return !!res?.ok
}

/** Record a create/update for the incremental-sync log. */
export async function logChangeToCache(
  table: string,
  rowId: string,
  op: 'create' | 'update' | 'delete'
): Promise<boolean> {
  const res = await call('logChange', { table, rowId, op })
  return !!res?.ok
}

// ─── Pending-backup tracking ─────────────────────────────────────────────────
// Statement imports register here; mutation edits land in local_changelog.
// A backup (pushEncrypted) snapshots the whole OPFS cache, so success clears
// both. Single-writer: only the vault store clears; everyone else only reads.

export const PENDING_BACKUP_KEY = 'momoney_pending_backup'
export const LAST_BACKUP_AT_KEY = 'momoney_last_backup_at'

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // private mode — markers just won't persist
  }
}

/** Statement ids imported locally but not yet covered by any backup. */
export function readPendingStatements(): Set<string> {
  try {
    const raw = readStorage(PENDING_BACKUP_KEY)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function writePendingStatements(ids: Set<string>): void {
  writeStorage(PENDING_BACKUP_KEY, JSON.stringify([...ids]))
}

export function readLastBackupAt(): string | null {
  return readStorage(LAST_BACKUP_AT_KEY)
}

function writeLastBackupAt(iso: string): void {
  writeStorage(LAST_BACKUP_AT_KEY, iso)
}

export function markBackupComplete(): void {
  writePendingStatements(new Set())
  writeLastBackupAt(new Date().toISOString())
}

export interface PendingWork {
  /** Local-only statement imports awaiting backup. */
  statements: string[]
  /** Mutation-log entries awaiting backup (edits). */
  edits: number
}

/** Everything not yet covered by a successful backup. */
export async function getPendingWork(): Promise<PendingWork> {
  const [statements, changelog] = await Promise.all([
    Promise.resolve(readPendingStatements()),
    call('getChangelog').then(
      (res) => (res?.rows ?? []) as unknown as Array<{ id: number }>,
      () => [] as Array<{ id: number }>
    ),
  ])
  return { statements: [...statements], edits: changelog.length }
}

export async function hasPendingWork(): Promise<boolean> {
  const w = await getPendingWork().catch(() => ({ statements: [], edits: 0 }))
  return w.statements.length > 0 || w.edits > 0
}

export interface OwnerShare {
  ownerId: string
  name: string
  color: string | null
  isDefault: boolean
  amount: string
  percentage: string
}

export interface ChangelogEntry {
  id: number
  table: string
  rowId: string
  op: string
  createdAt: number
}

/** Patch local transaction fields (vault-gated mutation path). */
export async function patchTransactionInCache(
  id: string,
  patch: { categoryId?: string | null; isOneTime?: boolean; comment?: string | null; merchant?: string | null }
): Promise<boolean> {
  const res = await call('patchTransaction', { id, patch })
  return !!res?.ok
}

/** Replace local owner shares with equal split (mirrors the server). */
export async function setTransactionOwnersInCache(
  transactionId: string,
  ownerIds: string[]
): Promise<OwnerShare[] | null> {
  const res = await call('setOwners', { transactionId, ownerIds })
  if (!res?.ok) return null
  return (res.rows ?? []) as unknown as OwnerShare[]
}

/** Read local transaction rows by id (for post-mutation UI merges). */
export async function getTransactionsFromCache(ids: string[]): Promise<LocalTransaction[]> {
  if (ids.length === 0) return []
  const res = await call('getByIds', { ids })
  if (!res?.ok) return []
  return ((res.rows ?? []) as Record<string, unknown>[]).map(mapCacheRowToTransaction)
}

/** Read the pending-sync operation log (Phase 5 incremental sync reads this). */
export async function readChangelog(): Promise<ChangelogEntry[]> {
  const res = await call('getChangelog')
  if (!res?.ok) return []
  return (res.rows ?? []) as unknown as ChangelogEntry[]
}

/** Clear changelog entries up to an id (after a successful incremental sync). */
export async function clearChangelog(upToId: number): Promise<boolean> {
  const res = await call('clearChangelog', { upToId })
  return !!res?.ok
}

/** Replace an invoice's statement links (local draft editing). */
export async function rewriteInvoiceLinksInCache(
  invoiceId: string,
  statements: Array<{
    statementId: string | null
    accountId: string | null
    statementMonth: string
    accountName: string
    accountType: string
  }>
): Promise<boolean> {
  const res = await call('rewriteInvoiceLinks', { invoiceId, statements })
  return !!res?.ok
}

/** Delete a local invoice (header + links + items). */
export async function deleteInvoiceFromCache(invoiceId: string): Promise<boolean> {
  const res = await call('deleteInvoice', { invoiceId })
  return !!res?.ok
}

/** Drop an invoice's frozen items (revert to draft). */
export async function deleteInvoiceItemsFromCache(invoiceId: string): Promise<boolean> {
  const res = await call('deleteInvoiceItems', { invoiceId })
  return !!res?.ok
}

/** Flip a local invoice between draft and generated. */
export async function setInvoiceStatusInCache(
  invoiceId: string,
  status: 'draft' | 'generated',
  generatedAt: string | null
): Promise<boolean> {
  const res = await call('setInvoiceStatus', { invoiceId, status, generatedAt })
  return !!res?.ok
}

/** Seal the OPFS database file with the vault DEK (lock). Best-effort. */
export async function sealLocalDb(dek: Uint8Array): Promise<boolean> {
  const res = await call('seal', { dek: dek.slice() }, 60_000)
  return !!res?.ok
}

/** Unseal the OPFS database file with the vault DEK (unlock). Best-effort. */
export async function unsealLocalDb(dek: Uint8Array): Promise<boolean> {
  const res = await call('unseal', { dek: dek.slice() }, 60_000)
  return !!res?.ok
}

export async function isLocalDbSealed(): Promise<boolean> {
  const res = await call('sealedExists')
  return !!res?.sealed
}

export interface LocalDbStats {
  sealed: boolean
  counts: Record<string, number> | null
}

/** Row counts per table + sealed flag. Never creates a database (safe locked). */
export async function getLocalDbStats(): Promise<LocalDbStats | null> {
  const res = await call('stats', undefined, 30_000)
  if (!res?.ok) return null
  const counts = res.rows?.[0] as Record<string, number> | undefined
  return { sealed: !!res.sealed, counts: counts ? { ...counts } : null }
}

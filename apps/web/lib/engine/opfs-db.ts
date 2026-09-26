// ─── OPFS SQLite client (main-thread facade) ────────────────────────────────
// All SQLite work happens in workers/db.worker.ts (OPFS sync handles require
// a dedicated Worker). This module is a thin promise-based facade with
// graceful degradation: every op returns null/false when Workers/OPFS are
// unavailable, and callers fall back to the cloud API.

import type { DbWorkerRequest, DbWorkerResponse } from '@/workers/db.worker'
import type {
  LocalCategory,
  LocalFinancialAccount,
  LocalInvoice,
  LocalInvoiceItem,
  LocalInvoiceStatement,
  LocalMerchant,
  LocalOwner,
  LocalRule,
  LocalStatement,
  LocalTransaction,
  LocalTransactionOwner,
} from '@momoney/local-engine'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: DbWorkerResponse) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  try {
    if (!worker) {
      worker = new Worker(new URL('@/workers/db.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<DbWorkerResponse>) => {
        const entry = pending.get(e.data.id)
        if (!entry) return
        pending.delete(e.data.id)
        entry.resolve(e.data)
      }
      worker.onerror = () => {
        for (const [, entry] of pending) entry.reject(new Error('DB worker error'))
        pending.clear()
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
  if (!w) return null
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
    return res
  } catch (err) {
    console.warn(`[opfs-db] ${op} failed:`, err)
    return null
  }
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
}

export type LocalCachePatch = Partial<LocalCache>

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
  }
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

// ─── OPFS SQLite client (main-thread facade) ────────────────────────────────
// All SQLite work happens in workers/db.worker.ts (OPFS sync handles require
// a dedicated Worker). This module is a thin promise-based facade with
// graceful degradation: every op returns null/false when Workers/OPFS are
// unavailable, and callers fall back to the cloud API.

import type { DbWorkerRequest, DbWorkerResponse } from '@/workers/db.worker'
import type { LocalCategory, LocalStatement, LocalTransaction } from '@momoney/local-engine'

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

/** Cache server rows into OPFS. Fire-and-forget safe (returns false on failure). */
export async function cacheServerRows(cache: LocalCache): Promise<boolean> {
  const res = await call(
    'upsert',
    {
      transactions: cache.transactions,
      categories: cache.categories,
      statements: cache.statements,
    },
    60_000
  )
  return !!res?.ok
}

/** Read the full local cache. Null when unavailable or empty. */
export async function readLocalCache(): Promise<LocalCache | null> {
  const res = await call('readAll', undefined, 30_000)
  const bundle = res?.rows?.[0] as
    | { transactions: Record<string, unknown>[]; categories: Record<string, unknown>[]; statements: Record<string, unknown>[] }
    | undefined
  if (!bundle || bundle.transactions.length === 0) return null
  return {
    transactions: bundle.transactions.map(rowToTransaction),
    categories: bundle.categories.map((c) => ({
      id: String(c['id']),
      name: String(c['name']),
      color: (c['color'] as string | null) ?? null,
      type: (c['type'] as LocalCategory['type']) ?? 'expense',
    })),
    statements: bundle.statements.map((s) => ({
      id: String(s['id']),
      accountId: String(s['account_id']),
      bankId: String(s['bank_id']),
      statementMonth: String(s['statement_month']),
      parsedCount: Number(s['parsed_count'] ?? 0),
      importedCount: Number(s['imported_count'] ?? 0),
      duplicatesSkipped: Number(s['duplicates_skipped'] ?? 0),
    })),
  }
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

// ─── Reference-table CRUD, vault-gated ──────────────────────────────────────
// Accounts, owners, rules, merchants, categories, net-worth rows: small,
// slow-changing tables the UI reads everywhere. When unlocked they live in
// OPFS (read + write locally, ciphertext backup later); otherwise the pages
// use their existing server calls. This module implements ONLY the local
// side — pages branch explicitly so server behavior stays byte-identical.
//
// Shapes mirror analytics-client's bulk mappers (same server contracts).

import { useVaultStore } from '@/lib/store/vault.store'
import {
  cacheServerRows,
  deleteRowFromCache,
  logChangeToCache,
  readLocalCache,
  type LocalCache,
} from './opfs-db'
import { scheduleEncryptedBackup } from './mutations'
import { isServerRetired } from './opfs-db'

export function useReferenceLocal(): boolean {
  try {
    return useVaultStore.getState().isUnlocked()
  } catch {
    return false
  }
}

type CacheKey =
  | 'accounts'
  | 'owners'
  | 'rules'
  | 'merchants'
  | 'categories'
  | 'assets'
  | 'liabilities'
  | 'netWorthSnapshots'
  | 'netWorthDrafts'

const TABLE_FOR_KEY: Record<CacheKey, string> = {
  accounts: 'local_accounts',
  owners: 'local_owners',
  rules: 'local_rules',
  merchants: 'local_merchants',
  categories: 'local_categories',
  assets: 'local_assets',
  liabilities: 'local_liabilities',
  netWorthSnapshots: 'local_networth_snapshots',
  netWorthDrafts: 'local_networth_drafts',
}

/** Read a reference table from OPFS. Null when unavailable/empty. */
export async function readReferenceTable<K extends CacheKey>(key: K): Promise<LocalCache[K] | null> {
  const cache = await readLocalCache().catch(() => null)
  if (!cache) return null
  const rows = cache[key]
  if (!rows || rows.length === 0) return null
  return rows as LocalCache[K]
}

/**
 * Merged reference read: server canonical + OPFS-exclusive rows (server wins
 * by id), with server rows converged into OPFS for offline reads. Used by
 * every reference picker/list so vault-only rows are never invisible.
 */
export async function loadReferenceMerged<K extends CacheKey>(
  key: K,
  serverFetch: () => Promise<unknown[]>
): Promise<LocalCache[K]> {
  const [local, server] = await Promise.all([
    readReferenceTable(key).catch(() => null),
    // Retired servers hold nothing — don't even ask (no access metadata).
    (isServerRetired() ? Promise.resolve([] as unknown[]) : serverFetch().catch(() => [] as unknown[])),
  ])
  const list = (server ?? []) as Array<Record<string, unknown>>
  if (list.length > 0) {
    cacheServerRows({ [key]: list } as Partial<LocalCache>).catch(() => {})
  }
  const localList = ((local ?? []) as unknown as Array<{ id: string }>)
  const serverIds = new Set(list.map((r) => r.id as string))
  const merged = [...list, ...localList.filter((r) => !serverIds.has(r.id))]
  return merged as unknown as LocalCache[K]
}

/** Create a row locally (client UUID) + changelog + backup. Returns false on failure. */
export async function createReferenceRow(
  key: CacheKey,
  row: Record<string, unknown>
): Promise<boolean> {
  const id = (row['id'] as string | undefined) ?? crypto.randomUUID()
  const ok = await cacheServerRows({ [key]: [{ ...row, id }] } as Partial<LocalCache>)
  if (!ok) return false
  await logChangeToCache(TABLE_FOR_KEY[key], id, 'create').catch(() => {})
  scheduleEncryptedBackup()
  return true
}

/** Update a row locally (upsert by id) + changelog + backup. */
export async function updateReferenceRow(
  key: CacheKey,
  row: Record<string, unknown> & { id: string }
): Promise<boolean> {
  const ok = await cacheServerRows({ [key]: [row] } as Partial<LocalCache>)
  if (!ok) return false
  await logChangeToCache(TABLE_FOR_KEY[key], row.id, 'update').catch(() => {})
  scheduleEncryptedBackup()
  return true
}

/** Delete a row locally + changelog + backup. */
export async function deleteReferenceRow(key: CacheKey, id: string): Promise<boolean> {
  // deleteRow already appends the delete entry.
  const ok = await deleteRowFromCache(TABLE_FOR_KEY[key], id)
  if (!ok) return false
  scheduleEncryptedBackup()
  return true
}

export interface CategoryDeleteUsage {
  transactionCount: number
  ruleCount: number
}

/** Count transactions + rules pointing at a category (usage dialog). */
export async function categoryUsageLocal(categoryId: string): Promise<CategoryDeleteUsage> {
  const cache = await readLocalCache().catch(() => null)
  return {
    transactionCount: cache?.transactions.filter((t) => t.categoryId === categoryId).length ?? 0,
    ruleCount: cache?.rules.filter((r) => r.categoryId === categoryId).length ?? 0,
  }
}

/**
 * Delete a category with full server semantics: remap transactions to the
 * target (or system 'Uncategorized' when null), remap invoice items,
 * remap-or-delete rules (NOT NULL), remap merchant defaults, null out child
 * categories, then delete. Returns remapped transaction count.
 */
export async function deleteCategoryLocal(
  categoryId: string,
  moveToCategoryId: string | null | undefined
): Promise<{ remappedTransactionsCount: number }> {
  const cache = await readLocalCache().catch(() => null)
  if (!cache) throw new Error('Local cache unavailable')

  let finalTargetId: string | null = null
  if (moveToCategoryId) {
    finalTargetId = moveToCategoryId
  } else if (moveToCategoryId === null) {
    finalTargetId = cache.categories.find((c) => c.name === 'Uncategorized')?.id ?? null
  }

  const { patchTransactionInCache } = await import('./opfs-db')
  const affected = cache.transactions.filter((t) => t.categoryId === categoryId)
  for (const t of affected) {
    await patchTransactionInCache(t.id, { categoryId: finalTargetId })
  }

  const items = (cache.invoiceItems ?? []).filter((i) => i.categoryId === categoryId)
  if (items.length > 0) {
    const target = finalTargetId ? cache.categories.find((c) => c.id === finalTargetId) : undefined
    await cacheServerRows({
      invoiceItems: items.map((i) => ({
        ...i,
        categoryId: finalTargetId,
        categoryName: target?.name ?? (finalTargetId ? i.categoryName : 'Uncategorized'),
        categoryColor: target?.color ?? (finalTargetId ? i.categoryColor : null),
      })),
    }).catch(() => {})
  }

  const rules = cache.rules.filter((r) => r.categoryId === categoryId)
  if (finalTargetId) {
    for (const r of rules) {
      await updateReferenceRow('rules', { ...r, categoryId: finalTargetId })
    }
  } else {
    for (const r of rules) {
      await deleteRowFromCache('local_rules', r.id)
    }
  }

  const merchants = cache.merchants.filter((m) => m.defaultCategoryId === categoryId)
  for (const m of merchants) {
    await updateReferenceRow('merchants', { ...m, defaultCategoryId: finalTargetId })
  }

  const children = cache.categories.filter(
    (c) => (c as unknown as { parentId?: string | null }).parentId === categoryId
  )
  for (const child of children) {
    await updateReferenceRow('categories', { ...(child as unknown as Record<string, unknown>), parentId: null, id: child.id })
  }

  await deleteRowFromCache('local_categories', categoryId)
  scheduleEncryptedBackup()
  return { remappedTransactionsCount: affected.length }
}

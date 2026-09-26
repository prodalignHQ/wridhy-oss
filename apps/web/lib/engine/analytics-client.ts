// ─── Local analytics client ─────────────────────────────────────────────────
// Data source priority: OPFS SQLite cache (offline, on-device) → cloud API
// (then opportunistically cached). Compute is always local via
// @momoney/local-engine. The legacy IndexedDB snapshot vault is kept as a
// secondary cache for pre-OPFS clients.

'use client'

import {
  createIndexedDbVault,
  getCategoryAveragesLocal,
  getCategoryComparisonLocal,
  getMonthlyInsightsLocal,
  getYearlyInsightsLocal,
  type LocalCategory,
  type LocalStatement,
  type LocalTransaction,
} from '@momoney/local-engine'
import type { AccountingMode } from '@momoney/types'
import { apiClient } from '@/lib/api'
import { cacheServerRows, readLocalCache } from './opfs-db'

const vault = typeof window !== 'undefined' ? createIndexedDbVault() : null

interface ServerTransaction {
  id: string
  accountId: string
  statementId: string | null
  date: string
  description: string
  merchant: string | null
  amount: string
  type: 'debit' | 'credit'
  isOneTime: boolean
  categoryId: string | null
  comment: string | null
  dedupHash: string
  category?: { id: string; name: string; color: string; type?: string } | null
}

interface ServerCategory {
  id: string
  name: string
  color: string
  type?: 'expense' | 'investment' | 'income' | 'transfer'
}

async function loadLocalInput(): Promise<{
  transactions: LocalTransaction[]
  categories: LocalCategory[]
  statements: LocalStatement[]
}> {
  // 1. Prefer the on-device OPFS cache (offline, no network).
  try {
    const cached = await readLocalCache()
    if (cached) return cached
  } catch {
    // fall through to cloud
  }

  const [catsRaw, stmtsRaw] = await Promise.all([
    apiClient.fetch<ServerCategory[]>('/v1/categories').catch(() => [] as ServerCategory[]),
    apiClient.fetch<Array<{ id: string; accountId: string; bankId: string; statementMonth: string; parsedCount: number; importedCount: number; duplicatesSkipped: number }>>('/v1/statements').catch(
      () => []
    ),
  ])

  // Paginate through all transactions (server caps limit at 200). Bounded at
  // 10k rows to avoid runaway fetches; vault sync will replace this.
  const all: ServerTransaction[] = []
  let page = 1
  for (;;) {
    const chunk = await apiClient
      .fetch<{ transactions: ServerTransaction[]; total: number; totalPages: number }>(
        `/v1/transactions?limit=200&page=${page}`
      )
      .catch(() => null)
    if (!chunk || chunk.transactions.length === 0) break
    all.push(...chunk.transactions)
    if (page >= (chunk.totalPages || 1) || all.length >= 10000) break
    page++
  }
  const transactions: ServerTransaction[] = all

  const input = {
    transactions: transactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      statementId: t.statementId,
      date: typeof t.date === 'string' ? t.date.slice(0, 10) : new Date(t.date).toISOString().slice(0, 10),
      description: t.description,
      merchant: t.merchant,
      amount: String(t.amount),
      type: t.type,
      isOneTime: Boolean(t.isOneTime),
      categoryId: t.categoryId,
      comment: t.comment,
      dedupHash: t.dedupHash,
    })),
    categories: (catsRaw as ServerCategory[]).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? null,
      type: (c.type ?? 'expense') as LocalCategory['type'],
    })),
    statements: (stmtsRaw as Array<{ id: string; accountId: string; bankId: string; statementMonth: string; parsedCount: number; importedCount: number; duplicatesSkipped: number }>).map((s) => ({
      id: s.id,
      accountId: s.accountId,
      bankId: s.bankId,
      statementMonth: s.statementMonth,
      parsedCount: s.parsedCount ?? 0,
      importedCount: s.importedCount ?? 0,
      duplicatesSkipped: s.duplicatesSkipped ?? 0,
    })),
  }

  // 2. Opportunistically converge the OPFS cache toward cloud truth.
  cacheServerRows(input).catch(() => {})

  return input
}

/** Refresh the OPFS cache from the cloud. Fire-and-forget safe. */
export async function refreshLocalCache(): Promise<void> {
  try {
    await loadLocalInput()
  } catch {
    // offline or worker unavailable — cache converges on next analytics load
  }
}

export const localAnalytics = {  async monthly(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    if (vault) {
      await vault.save({ ...input, owners: [], updatedAt: new Date().toISOString() }).catch(() => {})
    }
    return getMonthlyInsightsLocal(input, month, ownerIds, mode)
  },
  async yearly(year: number, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getYearlyInsightsLocal(input, year, ownerIds, mode)
  },
  async categoryComparison(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getCategoryComparisonLocal(input, month, ownerIds, mode)
  },
  async categoryAverages(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getCategoryAveragesLocal(input, month, ownerIds, mode)
  },
}

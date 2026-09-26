// ─── Local analytics client ─────────────────────────────────────────────────
// Fetches server rows once (existing API), caches them in IndexedDB vault,
// then computes insights locally via @momoney/local-engine. This is the
// stepping stone to full OPFS/SQLCipher: the compute path is already local,
// only the data source is still the cloud API until vault sync lands.

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

  return {
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
}

export const localAnalytics = {
  async monthly(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
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

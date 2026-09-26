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
  type LocalAnalyticsInput,
  type LocalCategory,
} from '@momoney/local-engine'
import type { AccountingMode } from '@momoney/types'
import { apiClient } from '@/lib/api'
import {
  cacheServerRows,
  deleteTransactionsFromCache,
  readLocalCache,
  type LocalCache,
} from './opfs-db'

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
  transactionOwners?: Array<{
    ownerId: string
    amount: string
    percentage: string
  }>
}

interface ServerCategory {
  id: string
  name: string
  color: string
  type?: 'expense' | 'investment' | 'income' | 'transfer'
}

interface ServerAccount {
  id: string
  accountName: string
  accountType: string
  bankId: string
  bankName: string
  currency?: string
}

interface ServerOwner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

interface ServerRule {
  id: string
  userId: string | null
  matchField: 'merchant' | 'description' | 'amount'
  matchType: 'contains' | 'equals' | 'regex' | 'gt' | 'lt'
  matchValue: string
  categoryId: string
  priority: number
  source: 'system' | 'user'
  isActive: boolean
}

interface ServerMerchant {
  id: string
  userId: string | null
  rawPatterns: string[]
  normalizedName: string
  defaultCategoryId: string | null
  isSystem: boolean
}

type LocalInput = LocalCache

/** Shape the full cache into what the analytics engine consumes. */
function toAnalyticsInput(src: LocalCache): LocalAnalyticsInput {
  return {
    transactions: src.transactions,
    categories: src.categories,
    statements: src.statements,
    owners: src.transactionOwners,
    invoiceLinks: (src.invoiceStatements ?? [])
      .filter((s) => !!s.statementId)
      .map((s) => ({
        statementId: s.statementId as string,
        invoiceId: s.invoiceId,
        invoiceMonth: s.statementMonth.slice(0, 7) + '-01',
      })),
  }
}

async function loadLocalInput(): Promise<LocalInput> {
  // 1. Read the on-device cache (offline fallback + convergence base).
  let cached: LocalCache | null = null
  try {
    cached = await readLocalCache()
  } catch {
    cached = null
  }

  // 2. Fetch cloud truth. Any failure → serve the cache (may be null → empty).
  let cloud: LocalInput | null = null
  try {
    cloud = await fetchCloudInput()
  } catch {
    cloud = null
  }
  if (!cloud) {
    return (
      cached ?? {
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
      }
    )
  }

  // 3. Converge: drop local rows superseded by server rows (same dedupHash,
  // different id — i.e. locally imported, then backed up), then upsert cloud.
  if (cached) {
    const serverIds = new Set(cloud.transactions.map((t) => t.id))
    const serverHashes = new Set(cloud.transactions.map((t) => t.dedupHash))
    const staleIds = cached.transactions
      .filter((t) => t.dedupHash && serverHashes.has(t.dedupHash) && !serverIds.has(t.id))
      .map((t) => t.id)
    if (staleIds.length > 0) await deleteTransactionsFromCache(staleIds).catch(() => {})
  }
  cacheServerRows(cloud).catch(() => {})

  return cloud
}

async function fetchCloudInput(): Promise<LocalInput> {
  const [catsRaw, stmtsRaw, acctsRaw, ownersRaw, rulesRaw, merchantsRaw, invoicesRaw] = await Promise.all([
    apiClient.fetch<ServerCategory[]>('/v1/categories'),
    apiClient.fetch<
      Array<{
        id: string
        accountId: string
        bankId: string
        statementMonth: string
        parsedCount: number
        importedCount: number
        duplicatesSkipped: number
      }>
    >('/v1/statements'),
    apiClient.fetch<ServerAccount[]>('/v1/accounts').catch(() => [] as ServerAccount[]),
    apiClient.fetch<ServerOwner[]>('/v1/owners').catch(() => [] as ServerOwner[]),
    apiClient.fetch<ServerRule[]>('/v1/rules').catch(() => [] as ServerRule[]),
    apiClient.fetch<ServerMerchant[]>('/v1/merchants').catch(() => [] as ServerMerchant[]),
    apiClient
      .fetch<
        Array<{
          id: string
          name: string
          status: 'draft' | 'generated'
          invoiceMonth: string
          generatedAt: string | null
          statements: Array<{
            statementId: string | null
            accountId: string | null
            statementMonth: string
            accountName: string
            accountType: string
          }>
        }>
      >('/v1/invoices')
      .catch(() => []),
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

  const input: LocalInput = {
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
    categories: catsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? null,
      type: (c.type ?? 'expense') as LocalCategory['type'],
    })),
    statements: stmtsRaw.map((s) => ({
      id: s.id,
      accountId: s.accountId,
      bankId: s.bankId,
      statementMonth: s.statementMonth,
      parsedCount: s.parsedCount ?? 0,
      importedCount: s.importedCount ?? 0,
      duplicatesSkipped: s.duplicatesSkipped ?? 0,
    })),
    accounts: acctsRaw.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      accountType: a.accountType,
      bankId: a.bankId,
      bankName: a.bankName,
      currency: a.currency ?? 'INR',
    })),
    owners: ownersRaw.map((o) => ({
      id: o.id,
      name: o.name,
      notes: o.notes ?? null,
      color: o.color,
      isDefault: o.isDefault,
    })),
    transactionOwners: transactions.flatMap((t) =>
      (t.transactionOwners ?? []).map((sh) => ({
        transactionId: t.id,
        ownerId: sh.ownerId,
        amount: String(sh.amount),
        percentage: String(sh.percentage),
      }))
    ),
    rules: rulesRaw.map((r) => ({
      id: r.id,
      userId: r.userId ?? null,
      matchField: r.matchField,
      matchType: r.matchType,
      matchValue: r.matchValue,
      categoryId: r.categoryId,
      priority: r.priority,
      source: r.source,
      isActive: r.isActive,
    })),
    merchants: merchantsRaw.map((m) => ({
      id: m.id,
      userId: m.userId ?? null,
      rawPatterns: m.rawPatterns ?? [],
      normalizedName: m.normalizedName,
      defaultCategoryId: m.defaultCategoryId ?? null,
      isSystem: m.isSystem,
    })),
    invoices: invoicesRaw.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      invoiceMonth: v.invoiceMonth,
      generatedAt: v.generatedAt ?? null,
    })),
    invoiceStatements: invoicesRaw.flatMap((v) =>
      v.statements.map((s) => ({
        invoiceId: v.id,
        statementId: s.statementId ?? null,
        accountId: s.accountId ?? null,
        statementMonth: s.statementMonth,
        accountName: s.accountName,
        accountType: s.accountType,
      }))
    ),
    invoiceItems: [],
  }

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

/** Small reference tables for the local import pipeline (rules/categories/merchants). */
export async function fetchReferenceData(): Promise<{
  rules: LocalCache['rules']
  categories: LocalCache['categories']
  userMerchants: LocalCache['merchants']
}> {
  const [rulesRaw, catsRaw, merchantsRaw] = await Promise.all([
    apiClient.fetch<ServerRule[]>('/v1/rules').catch(() => [] as ServerRule[]),
    apiClient.fetch<ServerCategory[]>('/v1/categories').catch(() => [] as ServerCategory[]),
    apiClient.fetch<ServerMerchant[]>('/v1/merchants').catch(() => [] as ServerMerchant[]),
  ])
  return {
    rules: rulesRaw.map((r) => ({
      id: r.id,
      userId: r.userId ?? null,
      matchField: r.matchField,
      matchType: r.matchType,
      matchValue: r.matchValue,
      categoryId: r.categoryId,
      priority: r.priority,
      source: r.source,
      isActive: r.isActive,
    })),
    categories: catsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? null,
      type: (c.type ?? 'expense') as LocalCache['categories'][number]['type'],
    })),
    userMerchants: merchantsRaw
      .filter((m) => !m.isSystem)
      .map((m) => ({
        id: m.id,
        userId: m.userId ?? null,
        rawPatterns: m.rawPatterns ?? [],
        normalizedName: m.normalizedName,
        defaultCategoryId: m.defaultCategoryId ?? null,
        isSystem: m.isSystem,
      })),
  }
}

export const localAnalytics = {
  async monthly(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    if (vault) {
      await vault
        .save({
          transactions: input.transactions,
          categories: input.categories,
          statements: input.statements,
          owners: input.transactionOwners,
          financialAccounts: input.accounts,
          ownerList: input.owners,
          rules: input.rules,
          merchants: input.merchants,
          invoices: input.invoices,
          invoiceStatements: input.invoiceStatements,
          invoiceItems: input.invoiceItems,
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {})
    }
    return getMonthlyInsightsLocal(toAnalyticsInput(input), month, ownerIds, mode)
  },
  async yearly(year: number, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getYearlyInsightsLocal(toAnalyticsInput(input), year, ownerIds, mode)
  },
  async categoryComparison(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getCategoryComparisonLocal(toAnalyticsInput(input), month, ownerIds, mode)
  },
  async categoryAverages(month: string, ownerIds?: string[], mode: AccountingMode = 'invoice') {
    const input = await loadLocalInput()
    return getCategoryAveragesLocal(toAnalyticsInput(input), month, ownerIds, mode)
  },
}

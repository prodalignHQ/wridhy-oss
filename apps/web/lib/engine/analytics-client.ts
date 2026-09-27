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
  emptyCache,
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

interface ServerAsset {
  id: string
  ownerId?: string | null
  name: string
  type: string
  value: string
  currency?: string
  equityDebtTag?: string | null
  metadata?: Record<string, unknown>
  valuationDate: string
  createdAt: string
  updatedAt: string
}

interface ServerLiability {
  id: string
  ownerId?: string | null
  name: string
  type: string
  outstandingAmount: string
  interestRate?: string | null
  monthlyPayment?: string | null
  lastUpdated: string
  createdAt: string
}

interface ServerNetWorthSnapshot {
  id: string
  ownerId?: string | null
  snapshotDate: string
  totalAssets: string
  totalLiabilities: string
  netWorth: string
  assetBreakdown: LocalCache['netWorthSnapshots'][number]['assetBreakdown']
  liabilityBreakdown: LocalCache['netWorthSnapshots'][number]['liabilityBreakdown']
  notes?: string | null
  createdAt: string
}

interface ServerNetWorthDraft {
  id: string
  ownerId?: string | null
  assetBreakdown: Array<Record<string, unknown>> | null
  liabilityBreakdown: Array<Record<string, unknown>> | null
  savedAt?: string
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
    return cached ?? emptyCache()
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

  // 4. UNION (the step Phase 3 missed): server rows are canonical, but
  // vault-only rows live exclusively in OPFS. Return both — server wins on
  // dedupHash collision — so fresh imports are visible immediately.
  if (cached) {
    const serverHashes = new Set(cloud.transactions.map((t) => t.dedupHash))
    const serverIds = new Set(cloud.transactions.map((t) => t.id))
    const localOnly = cached.transactions.filter(
      (t) => !serverIds.has(t.id) && !(t.dedupHash && serverHashes.has(t.dedupHash))
    )
    if (localOnly.length > 0) {
      return { ...cloud, transactions: [...cloud.transactions, ...localOnly] }
    }
  }

  return cloud
}

/**
 * Merged read for any UI that lists transactions: server canonical +
 * OPFS-exclusive rows. Transactions page, invoice composer, and analytics
 * must all use this — raw OPFS misses server history, raw cloud misses
 * vault-only imports.
 */
export async function loadMergedInput(): Promise<LocalInput> {
  return loadLocalInput()
}

async function fetchCloudInput(options?: { maxRows?: number; onProgress?: (page: number, totalPages: number) => void }): Promise<LocalInput> {
  const maxRows = options?.maxRows ?? 10000
  const onProgress = options?.onProgress
  const [catsRaw, stmtsRaw, acctsRaw, ownersRaw, rulesRaw, merchantsRaw, invoicesRaw, assetsRaw, liabilitiesRaw, historyRaw, draftRaw] = await Promise.all([
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
    apiClient.fetch<ServerAsset[]>('/v1/networth/assets').catch(() => [] as ServerAsset[]),
    apiClient.fetch<ServerLiability[]>('/v1/networth/liabilities').catch(() => [] as ServerLiability[]),
    apiClient.fetch<ServerNetWorthSnapshot[]>('/v1/networth/history').catch(() => [] as ServerNetWorthSnapshot[]),
    apiClient.fetch<ServerNetWorthDraft | null>('/v1/networth/draft').catch(() => null),
  ])

  // Paginate through all transactions (server caps limit at 200).
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
    onProgress?.(page, chunk.totalPages || 1)
    if (page >= (chunk.totalPages || 1) || all.length >= maxRows) break
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
    assets: assetsRaw.map((a) => ({
      id: a.id,
      ownerId: a.ownerId ?? null,
      name: a.name,
      type: a.type,
      value: String(a.value),
      currency: a.currency ?? 'INR',
      equityDebtTag: a.equityDebtTag ?? null,
      metadata: a.metadata ?? {},
      valuationDate: typeof a.valuationDate === 'string' ? a.valuationDate.slice(0, 10) : new Date(a.valuationDate).toISOString().slice(0, 10),
      createdAt: String(a.createdAt),
      updatedAt: String(a.updatedAt),
    })),
    liabilities: liabilitiesRaw.map((l) => ({
      id: l.id,
      ownerId: l.ownerId ?? null,
      name: l.name,
      type: l.type,
      outstandingAmount: String(l.outstandingAmount),
      interestRate: l.interestRate ?? null,
      monthlyPayment: l.monthlyPayment ?? null,
      lastUpdated: typeof l.lastUpdated === 'string' ? l.lastUpdated.slice(0, 10) : new Date(l.lastUpdated).toISOString().slice(0, 10),
      createdAt: String(l.createdAt),
    })),
    netWorthSnapshots: historyRaw.map((s) => ({
      id: s.id,
      ownerId: s.ownerId ?? null,
      snapshotDate: typeof s.snapshotDate === 'string' ? s.snapshotDate.slice(0, 10) : new Date(s.snapshotDate).toISOString().slice(0, 10),
      totalAssets: String(s.totalAssets),
      totalLiabilities: String(s.totalLiabilities),
      netWorth: String(s.netWorth),
      assetBreakdown: s.assetBreakdown ?? null,
      liabilityBreakdown: s.liabilityBreakdown ?? null,
      notes: s.notes ?? null,
      createdAt: String(s.createdAt),
    })),
    netWorthDrafts: draftRaw
      ? [
          {
            id: draftRaw.id,
            ownerId: draftRaw.ownerId ?? null,
            assetBreakdown: draftRaw.assetBreakdown ?? null,
            liabilityBreakdown: draftRaw.liabilityBreakdown ?? null,
            savedAt: String(draftRaw.savedAt ?? new Date().toISOString()),
          },
        ]
      : [],
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

/** Light per-table server counts for migration inventory (no bulk fetch). */
export async function fetchServerCounts(): Promise<Array<{ key: string; label: string; count: number }>> {
  const [txns, stmts, cats, rules, merchants, accts, owners, assets, liabs, history, invoices] = await Promise.all([
    apiClient.fetch<{ total: number }>('/v1/transactions?limit=1&page=1').catch(() => ({ total: 0 })),
    apiClient.fetch<unknown[]>('/v1/statements').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/categories').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/rules').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/merchants').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/accounts').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/owners').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/networth/assets').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/networth/liabilities').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/networth/history').catch(() => []),
    apiClient.fetch<unknown[]>('/v1/invoices').catch(() => []),
  ])
  return [
    { key: 'transactions', label: 'Transactions', count: txns.total },
    { key: 'statements', label: 'Statements', count: stmts.length },
    { key: 'categories', label: 'Categories', count: cats.length },
    { key: 'rules', label: 'Categorization rules', count: rules.length },
    { key: 'merchants', label: 'Merchants', count: merchants.length },
    { key: 'accounts', label: 'Accounts', count: accts.length },
    { key: 'owners', label: 'Household members', count: owners.length },
    { key: 'assets', label: 'Assets', count: assets.length },
    { key: 'liabilities', label: 'Liabilities', count: liabs.length },
    { key: 'snapshots', label: 'Net-worth snapshots', count: history.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
  ]
}

/**
 * Unbounded full pull for migration (progress per transaction page).
 * Converges + caches exactly like loadLocalInput, then returns the input.
 */
export async function pullAllCloudData(
  onProgress?: (page: number, totalPages: number) => void
): Promise<LocalInput> {
  const { readLocalCache } = await import('./opfs-db')
  const cached = await readLocalCache().catch(() => null)
  const cloud = await fetchCloudInput({ maxRows: 500000, onProgress })
  if (cached) {
    const serverIds = new Set(cloud.transactions.map((t) => t.id))
    const serverHashes = new Set(cloud.transactions.map((t) => t.dedupHash))
    const staleIds = cached.transactions
      .filter((t) => t.dedupHash && serverHashes.has(t.dedupHash) && !serverIds.has(t.id))
      .map((t) => t.id)
    if (staleIds.length > 0) await deleteTransactionsFromCache(staleIds).catch(() => {})
  }
  await cacheServerRows(cloud).catch(() => {})
  return cloud
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

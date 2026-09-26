// ─── Local invoice drafts (offline fallback) ────────────────────────────────
// Composes an invoice detail view purely from the OPFS cache: invoice header
// + its statements → live cached transactions → local analysis. Used when the
// cloud API is unreachable. Edits (recategorize/split/generate) still go
// through the server when online — full offline editing is Phase 4.

import {
  buildInvoiceAnalysisLocal,
  type LocalInvoiceTxn,
} from '@momoney/local-engine'
import type { LocalCache as Cache } from './opfs-db'
import {
  cacheServerRows,
  deleteInvoiceFromCache,
  deleteInvoiceItemsFromCache,
  readLocalCache,
  rewriteInvoiceLinksInCache,
  setInvoiceStatusInCache,
} from './opfs-db'

export function isLocalInvoiceId(id: string): boolean {
  return id.startsWith('local-')
}

/** Create a draft invoice entirely on-device. Returns the local invoice id. */
export async function createLocalInvoice(
  name: string,
  invoiceMonth: string,
  statementIds: string[]
): Promise<string> {
  const cache = await readLocalCache()
  if (!cache) throw new Error('Local cache unavailable')
  const wanted = new Set(statementIds)
  const stmts = cache.statements.filter((s) => wanted.has(s.id))
  if (stmts.length === 0) throw new Error('No statements found on this device')
  const acctMap = new Map(cache.accounts.map((a) => [a.id, a]))
  const id = `local-${crypto.randomUUID()}`
  const normalizedMonth = invoiceMonth.length === 7 ? `${invoiceMonth}-01` : invoiceMonth.slice(0, 7) + '-01'
  await cacheServerRows({
    invoices: [{ id, name, status: 'draft', invoiceMonth: normalizedMonth, generatedAt: null }],
    invoiceStatements: stmts.map((s) => {
      const acct = acctMap.get(s.accountId)
      return {
        invoiceId: id,
        statementId: s.id,
        accountId: s.accountId,
        statementMonth: normalizedMonth,
        accountName: acct?.accountName ?? 'Unknown',
        accountType: acct?.accountType ?? 'bank',
      }
    }),
  })
  const { scheduleEncryptedBackup } = await import('./mutations')
  scheduleEncryptedBackup()
  return id
}

/** Snapshot live cached transactions into frozen invoice items (generate). */
export async function generateLocalInvoice(invoiceId: string): Promise<void> {
  const cache = await readLocalCache()
  if (!cache) throw new Error('Local cache unavailable')
  const links = cache.invoiceStatements.filter((s) => s.invoiceId === invoiceId)
  const statementIds = new Set(links.map((s) => s.statementId).filter((id): id is string => !!id))
  const catMap = new Map(cache.categories.map((c) => [c.id, c]))
  const ownerMap = new Map(cache.owners.map((o) => [o.id, o]))
  const sharesByTxn = new Map<string, Array<{ ownerId: string; amount: string; percentage: string }>>()
  for (const sh of cache.transactionOwners) {
    const arr = sharesByTxn.get(sh.transactionId) ?? []
    arr.push({ ownerId: sh.ownerId, amount: sh.amount, percentage: sh.percentage })
    sharesByTxn.set(sh.transactionId, arr)
  }
  const txns = cache.transactions
    .filter((t) => t.statementId && statementIds.has(t.statementId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  if (txns.length === 0) throw new Error('No transactions found for this invoice')
  const now = new Date().toISOString()
  await cacheServerRows({
    invoiceItems: txns.map((t) => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      const shares = sharesByTxn.get(t.id) ?? []
      return {
        id: `local-${crypto.randomUUID()}`,
        invoiceId,
        transactionId: t.id,
        statementId: t.statementId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        isOneTime: t.isOneTime,
        categoryId: t.categoryId,
        categoryName: cat?.name ?? 'Uncategorized',
        categoryColor: cat?.color ?? null,
        categoryType: cat?.type ?? 'expense',
        owners: shares.map((s) => {
          const o = ownerMap.get(s.ownerId)
          return {
            ownerId: s.ownerId,
            name: o?.name ?? 'Unknown',
            color: o?.color ?? null,
            amount: s.amount,
            percentage: s.percentage,
          }
        }),
      }
    }),
  })
  await setInvoiceStatusInCache(invoiceId, 'generated', now)
  const { scheduleEncryptedBackup } = await import('./mutations')
  scheduleEncryptedBackup()
}

/** Revert a local invoice to draft (drops frozen items). */
export async function draftLocalInvoice(invoiceId: string): Promise<void> {
  await deleteInvoiceItemsFromCache(invoiceId)
  await setInvoiceStatusInCache(invoiceId, 'draft', null)
  const { scheduleEncryptedBackup } = await import('./mutations')
  scheduleEncryptedBackup()
}

/** Save a local draft's name + statement selection. */
export async function saveLocalDraft(
  invoiceId: string,
  name: string,
  statementIds: string[]
): Promise<void> {
  const cache = await readLocalCache()
  if (!cache) throw new Error('Local cache unavailable')
  const header = cache.invoices.find((v) => v.id === invoiceId)
  if (!header) throw new Error('Invoice not found on this device')
  const wanted = new Set(statementIds)
  const stmts = cache.statements.filter((s) => wanted.has(s.id))
  const acctMap = new Map(cache.accounts.map((a) => [a.id, a]))
  await cacheServerRows({
    invoices: [
      {
        id: invoiceId,
        name,
        status: header.status,
        invoiceMonth: header.invoiceMonth,
        generatedAt: header.generatedAt,
      },
    ],
  })
  await rewriteInvoiceLinksInCache(
    invoiceId,
    stmts.map((s) => {
      const acct = acctMap.get(s.accountId)
      return {
        statementId: s.id,
        accountId: s.accountId,
        statementMonth: header.invoiceMonth,
        accountName: acct?.accountName ?? 'Unknown',
        accountType: acct?.accountType ?? 'bank',
      }
    })
  )
  const { scheduleEncryptedBackup } = await import('./mutations')
  scheduleEncryptedBackup()
}

/** Delete a local invoice entirely. */
export async function deleteLocalInvoice(invoiceId: string): Promise<void> {
  await deleteInvoiceFromCache(invoiceId)
  const { scheduleEncryptedBackup } = await import('./mutations')
  scheduleEncryptedBackup()
}

export interface LocalInvoiceDetailTransaction {
  id: string
  statementId: string | null
  date: string
  description: string
  amount: string
  type: 'debit' | 'credit'
  isOneTime?: boolean
  categoryId: string | null
  category: {
    id: string | null
    name: string
    color: string | null
    type?: string | null
  } | null
  owners: Array<{
    ownerId: string | null
    name: string
    color: string | null
    amount: string
    percentage: string
  }>
}

export function composeInvoiceDraftLocal(
  invoiceId: string,
  cache: Cache
): {
  id: string
  name: string
  status: 'draft' | 'generated'
  invoiceMonth: string
  generatedAt: string | null
  createdAt: string
  updatedAt: string
  statements: Array<{
    id: string
    statementId: string | null
    accountId: string | null
    statementMonth: string
    accountName: string
    accountType: string
  }>
  transactions: LocalInvoiceDetailTransaction[]
  analysis: ReturnType<typeof buildInvoiceAnalysisLocal>
  offline: true
} | null {
  const header = cache.invoices.find((v) => v.id === invoiceId)
  if (!header) return null

  // Generated invoices show their frozen snapshot items; drafts compose live.
  if (header.status === 'generated') {
    const items = (cache.invoiceItems ?? []).filter((i) => i.invoiceId === invoiceId)
    if (items.length > 0) {
      const detailTxns: LocalInvoiceDetailTransaction[] = items
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
        .map((t) => ({
          id: t.id,
          statementId: t.statementId,
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          isOneTime: t.isOneTime,
          categoryId: t.categoryId,
          category: {
            id: t.categoryId,
            name: t.categoryName,
            color: t.categoryColor,
            type: t.categoryType,
          },
          owners: t.owners,
        }))
      return {
        id: header.id,
        name: header.name,
        status: header.status,
        invoiceMonth: header.invoiceMonth,
        generatedAt: header.generatedAt,
        createdAt: header.generatedAt ?? new Date().toISOString(),
        updatedAt: header.generatedAt ?? new Date().toISOString(),
        statements: cache.invoiceStatements
          .filter((s) => s.invoiceId === invoiceId)
          .map((s, i) => ({
            id: `${header.id}:${i}`,
            statementId: s.statementId,
            accountId: s.accountId,
            statementMonth: s.statementMonth,
            accountName: s.accountName,
            accountType: s.accountType,
          })),
        transactions: detailTxns,
        analysis: buildInvoiceAnalysisLocal(
          detailTxns.map((t) => ({
            id: t.id,
            type: t.type,
            isOneTime: !!t.isOneTime,
            categoryName: t.category?.name ?? 'Uncategorized',
            categoryId: t.category?.id ?? null,
            categoryColor: t.category?.color ?? null,
            categoryType: t.category?.type ?? 'expense',
            owners: t.owners,
          }))
        ),
        offline: true as const,
      }
    }
  }

  const links = cache.invoiceStatements.filter((s) => s.invoiceId === invoiceId)
  const statementIds = new Set(
    links.map((s) => s.statementId).filter((id): id is string => !!id)
  )

  const catMap = new Map(cache.categories.map((c) => [c.id, c]))
  const ownerMap = new Map(cache.owners.map((o) => [o.id, o]))
  const sharesByTxn = new Map<string, Array<{ ownerId: string; amount: string; percentage: string }>>()
  for (const sh of cache.transactionOwners) {
    const arr = sharesByTxn.get(sh.transactionId) ?? []
    arr.push({ ownerId: sh.ownerId, amount: sh.amount, percentage: sh.percentage })
    sharesByTxn.set(sh.transactionId, arr)
  }

  const txns = cache.transactions
    .filter((t) => t.statementId && statementIds.has(t.statementId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const detailTxns: LocalInvoiceDetailTransaction[] = txns.map((t) => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    const shares = sharesByTxn.get(t.id) ?? []
    return {
      id: t.id,
      statementId: t.statementId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      isOneTime: t.isOneTime,
      categoryId: t.categoryId,
      category: cat
        ? { id: cat.id, name: cat.name, color: cat.color, type: cat.type }
        : null,
      owners: shares.map((s) => {
        const o = ownerMap.get(s.ownerId)
        return {
          ownerId: s.ownerId,
          name: o?.name ?? 'Unknown',
          color: o?.color ?? null,
          amount: s.amount,
          percentage: s.percentage,
        }
      }),
    }
  })

  const analysisTxns: LocalInvoiceTxn[] = detailTxns.map((t) => ({
    id: t.id,
    type: t.type,
    isOneTime: !!t.isOneTime,
    categoryName: t.category?.name ?? 'Uncategorized',
    categoryId: t.category?.id ?? null,
    categoryColor: t.category?.color ?? null,
    categoryType: t.category?.type ?? 'expense',
    owners: t.owners,
  }))

  return {
    id: header.id,
    name: header.name,
    status: header.status,
    invoiceMonth: header.invoiceMonth,
    generatedAt: header.generatedAt,
    createdAt: header.generatedAt ?? new Date().toISOString(),
    updatedAt: header.generatedAt ?? new Date().toISOString(),
    statements: links.map((s, i) => ({
      id: `${header.id}:${i}`,
      statementId: s.statementId,
      accountId: s.accountId,
      statementMonth: s.statementMonth,
      accountName: s.accountName,
      accountType: s.accountType,
    })),
    transactions: detailTxns,
    analysis: buildInvoiceAnalysisLocal(analysisTxns),
    offline: true as const,
  }
}

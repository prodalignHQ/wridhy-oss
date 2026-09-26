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

// ─── Local transaction query — mirrors server filtering ─────────────────────
// Ports apps/api/src/routes/transactions.ts buildTransactionConditions to the
// OPFS cache so the transactions UI reads on-device rows when the vault is
// unlocked. Semantics (uncategorized, unassigned owners, investment nature)
// match the server exactly; sort is date desc, id desc (no createdAt locally).

import type { LocalCache } from './opfs-db'
import type { LocalTransaction } from '@momoney/local-engine'

export interface LocalTxnFilters {
  accountId?: string
  startDate?: string
  endDate?: string
  categoryId?: string
  ownerId?: string
  type?: 'all' | 'debit' | 'credit'
  nature?: 'all' | 'regular' | 'one_time' | 'investment'
  isOneTime?: boolean
  search?: string
  page: number
  limit: number
}

export interface LocalTxnRow extends LocalTransaction {
  category: { id: string; name: string; color: string; icon: string | null; type?: 'expense' | 'investment' | 'income' | 'transfer' } | null
  account: { id: string; accountName: string; accountType: string; bankName: string } | null
  transactionOwners: Array<{
    id: string
    transactionId: string
    ownerId: string
    amount: string
    percentage: string
    owner: { id: string; name: string; color: string; isDefault: boolean }
  }>
}

export function queryLocalTransactions(
  cache: LocalCache,
  filters: LocalTxnFilters
): { rows: LocalTxnRow[]; total: number; totalPages: number } {
  const catMap = new Map(cache.categories.map((c) => [c.id, c]))
  const acctMap = new Map(cache.accounts.map((a) => [a.id, a]))
  const ownerMap = new Map(cache.owners.map((o) => [o.id, o]))
  const sharesByTxn = new Map<string, Array<{ ownerId: string; amount: string; percentage: string }>>()
  for (const sh of cache.transactionOwners) {
    const arr = sharesByTxn.get(sh.transactionId) ?? []
    arr.push({ ownerId: sh.ownerId, amount: sh.amount, percentage: sh.percentage })
    sharesByTxn.set(sh.transactionId, arr)
  }
  const investmentIds = new Set(cache.categories.filter((c) => c.type === 'investment').map((c) => c.id))

  const ownerParam = (filters.ownerId ?? 'all').trim()
  const ownerIds = ownerParam === 'all' ? [] : ownerParam.split(',').map((s) => s.trim()).filter(Boolean)
  const wantsUnassigned = ownerIds.includes('unassigned')
  const realOwnerIds = ownerIds.filter((id) => id !== 'unassigned')

  let list = cache.transactions.filter((t) => {
    if (filters.accountId && t.accountId !== filters.accountId) return false
    if (filters.search && !t.description.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.startDate && t.date < filters.startDate) return false
    if (filters.endDate && t.date > filters.endDate) return false
    if (filters.type && filters.type !== 'all' && t.type !== filters.type) return false

    const catId = filters.categoryId ?? 'all'
    if (catId !== 'all') {
      if (catId === 'uncategorized') {
        if (t.categoryId !== null) return false
      } else if (t.categoryId !== catId) return false
    }

    const nature = filters.nature ?? 'all'
    const isInvestment = !!t.categoryId && investmentIds.has(t.categoryId)
    if (nature === 'investment') {
      if (!isInvestment) return false
    } else if (nature === 'one_time') {
      if (!t.isOneTime || isInvestment) return false
    } else if (nature === 'regular') {
      if (t.isOneTime || isInvestment) return false
    } else if (filters.isOneTime !== undefined) {
      if (t.isOneTime !== filters.isOneTime) return false
    }

    if (ownerIds.length > 0) {
      const shares = sharesByTxn.get(t.id) ?? []
      const matched = shares.some((s) => realOwnerIds.includes(s.ownerId))
      if (wantsUnassigned) {
        if (realOwnerIds.length === 0) {
          if (shares.length > 0) return false
        } else if (!matched && shares.length > 0) return false
      } else if (!matched) return false
    }
    return true
  })

  list = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  const total = list.length
  const limit = Math.max(1, filters.limit)
  const page = Math.max(1, filters.page)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageRows = list.slice((page - 1) * limit, page * limit)

  const rows: LocalTxnRow[] = pageRows.map((t) => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    const acct = acctMap.get(t.accountId)
    const shares = sharesByTxn.get(t.id) ?? []
    return {
      ...t,
      category: cat
        ? {
            id: cat.id,
            name: cat.name,
            color: cat.color ?? '#6366f1',
            icon: null,
            type: (cat.type ?? 'expense') as 'expense' | 'investment' | 'income' | 'transfer',
          }
        : null,
      account: acct
        ? { id: acct.id, accountName: acct.accountName, accountType: acct.accountType, bankName: acct.bankName }
        : null,
      transactionOwners: shares.map((s) => {
        const o = ownerMap.get(s.ownerId)
        return {
          id: `${t.id}:${s.ownerId}`,
          transactionId: t.id,
          ownerId: s.ownerId,
          amount: s.amount,
          percentage: s.percentage,
          owner: {
            id: s.ownerId,
            name: o?.name ?? 'Unknown',
            color: o?.color ?? 'indigo',
            isDefault: o?.isDefault ?? false,
          },
        }
      }),
    }
  })

  return { rows, total, totalPages }
}

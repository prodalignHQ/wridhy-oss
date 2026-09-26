import { create } from 'zustand'
import { apiClient } from '../api'
import {
  localSetCategory,
  localSetOneTime,
  localSetOwners,
  useLocalMutations,
} from '../engine/mutations'
import { useVaultStore } from './vault.store'
import type { OwnerShare } from '../engine/opfs-db'
import type { LocalTransaction } from '@momoney/local-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
}

export interface TransactionOwner {
  id: string
  transactionId: string
  ownerId: string
  amount: string
  percentage: string
  owner: Owner
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  type?: 'expense' | 'investment' | 'income' | 'transfer'
}

export interface FinancialAccount {
  id: string
  accountName: string
  accountType: string
  bankName: string
}

export interface Transaction {
  id: string
  userId: string
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
  createdAt: string
  updatedAt: string
  category: Category | null
  account?: FinancialAccount | null
  transactionOwners: TransactionOwner[]
}

export interface TransactionFilters {
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

interface TransactionsState {
  transactions: Transaction[]
  total: number
  totalPages: number
  isLoading: boolean
  error: string | null
  filters: TransactionFilters
  setFilters: (filters: Partial<TransactionFilters>) => void
  fetchTransactions: () => Promise<void>
  updateTransactionOwners: (txnId: string, ownerIds: string[]) => Promise<void>
  updateTransactionCategory: (txnId: string, categoryId: string | null) => Promise<void>
  updateTransactionOneTime: (txnId: string, isOneTime: boolean) => Promise<void>
  bulkUpdateOneTime: (txnIds: string[], isOneTime: boolean) => Promise<void>
  bulkUpdateCategory: (txnIds: string[], categoryId: string | null) => Promise<void>
  bulkUpdateOwners: (txnIds: string[], ownerIds: string[]) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  total: 0,
  totalPages: 1,
  isLoading: false,
  error: null,
  filters: {
    page: 1,
    limit: 50,
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...filters,
        // Reset to page 1 when filters change (unless page is explicitly set)
        page: filters.page ?? 1,
      },
    }))
  },

  fetchTransactions: async () => {
    const { filters } = get()

    // Vault unlocked → query the on-device OPFS cache (imports land here
    // first and may never exist as server rows). Falls back to the server
    // when the cache is unavailable.
    if (useVaultStore.getState().isUnlocked()) {
      set({ isLoading: true, error: null })
      try {
        const [{ readLocalCache }, { queryLocalTransactions }] = await Promise.all([
          import('../engine/opfs-db'),
          import('../engine/local-query'),
        ])
        const cache = await readLocalCache()
        if (cache) {
          const { rows, total, totalPages } = queryLocalTransactions(cache, {
            accountId: filters.accountId,
            startDate: filters.startDate,
            endDate: filters.endDate,
            categoryId: filters.categoryId,
            ownerId: filters.ownerId,
            type: filters.type,
            nature: filters.nature,
            isOneTime: filters.isOneTime,
            search: filters.search,
            page: filters.page,
            limit: filters.limit,
          })
          set({
            transactions: rows.map((r) => ({
              id: r.id,
              userId: '',
              accountId: r.accountId,
              statementId: r.statementId,
              date: r.date,
              description: r.description,
              merchant: r.merchant,
              amount: r.amount,
              type: r.type,
              isOneTime: r.isOneTime,
              categoryId: r.categoryId,
              comment: r.comment,
              dedupHash: r.dedupHash,
              createdAt: r.date,
              updatedAt: r.date,
              category: r.category,
              account: r.account ?? undefined,
              transactionOwners: r.transactionOwners,
            })),
            total,
            totalPages,
            isLoading: false,
          })
          return
        }
      } catch (err) {
        console.warn('[transactions] local query failed, falling back to server', err)
      }
    }

    set({ isLoading: true, error: null })

    // Build query string from filters
    const params = new URLSearchParams()
    if (filters.accountId) params.set('accountId', filters.accountId)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.categoryId && filters.categoryId !== 'all') params.set('categoryId', filters.categoryId)
    if (filters.ownerId && filters.ownerId !== 'all') params.set('ownerId', filters.ownerId)
    if (filters.type && filters.type !== 'all') params.set('type', filters.type)
    if (filters.nature && filters.nature !== 'all') params.set('nature', filters.nature)
    if (filters.isOneTime !== undefined) params.set('isOneTime', String(filters.isOneTime))
    if (filters.search) params.set('search', filters.search)
    params.set('page', String(filters.page))
    params.set('limit', String(filters.limit))

    try {
      const data = await apiClient.fetch<{
        transactions: Transaction[]
        total: number
        totalPages: number
      }>(`/v1/transactions?${params.toString()}`)

      set({
        transactions: data.transactions,
        total: data.total,
        totalPages: data.totalPages,
        isLoading: false,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', isLoading: false })
    }
  },

  updateTransactionOwners: async (txnId, ownerIds) => {
    if (useLocalMutations()) {
      const { rows, sharesByTxn } = await localSetOwners([txnId], ownerIds)
      const row = rows[0]
      const shares = sharesByTxn[txnId] ?? []
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === txnId ? mergeLocalRow(t, row, mapShares(txnId, shares)) : t
        ),
      }))
      return
    }
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}/owners`, {
      method: 'PUT',
      body: JSON.stringify({ ownerIds }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },

  updateTransactionCategory: async (txnId, categoryId) => {
    if (useLocalMutations()) {
      const { rows, category } = await localSetCategory([txnId], categoryId)
      const row = rows[0]
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === txnId
            ? {
                ...mergeLocalRow(t, row),
                category: category
                  ? { id: category.id, name: category.name, color: category.color, icon: category.icon, type: t.category?.type }
                  : null,
              }
            : t
        ),
      }))
      return
    }
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },

  updateTransactionOneTime: async (txnId, isOneTime) => {
    if (useLocalMutations()) {
      const { rows } = await localSetOneTime([txnId], isOneTime)
      const row = rows[0]
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === txnId ? mergeLocalRow(t, row) : t)),
      }))
      return
    }
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isOneTime }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },

  bulkUpdateOneTime: async (txnIds, isOneTime) => {
    if (useLocalMutations()) {
      const { rows } = await localSetOneTime(txnIds, isOneTime)
      const byId = new Map(rows.map((r) => [r.id, r]))
      set((state) => ({
        transactions: state.transactions.map((t) => {
          const row = byId.get(t.id)
          return row ? mergeLocalRow(t, row) : t
        }),
      }))
      return
    }
    await apiClient.fetch('/v1/transactions/bulk/one-time', {
      method: 'PATCH',
      body: JSON.stringify({ transactionIds: txnIds, isOneTime }),
    })
    set((state) => ({
      transactions: state.transactions.map((t) =>
        txnIds.includes(t.id) ? { ...t, isOneTime } : t
      ),
    }))
  },

  bulkUpdateCategory: async (txnIds, categoryId) => {
    if (useLocalMutations()) {
      const { rows, category } = await localSetCategory(txnIds, categoryId)
      const byId = new Map(rows.map((r) => [r.id, r]))
      set((state) => ({
        transactions: state.transactions.map((t) => {
          const row = byId.get(t.id)
          return row
            ? {
                ...mergeLocalRow(t, row),
                category: category
                  ? { id: category.id, name: category.name, color: category.color, icon: category.icon, type: t.category?.type }
                  : null,
              }
            : t
        }),
      }))
      return
    }
    await apiClient.fetch('/v1/transactions/bulk/category', {
      method: 'PATCH',
      body: JSON.stringify({ transactionIds: txnIds, categoryId }),
    })
    await get().fetchTransactions()
  },

  bulkUpdateOwners: async (txnIds, ownerIds) => {
    if (useLocalMutations()) {
      const { rows, sharesByTxn } = await localSetOwners(txnIds, ownerIds)
      const byId = new Map(rows.map((r) => [r.id, r]))
      set((state) => ({
        transactions: state.transactions.map((t) => {
          const row = byId.get(t.id)
          return row ? mergeLocalRow(t, row, mapShares(t.id, sharesByTxn[t.id] ?? [])) : t
        }),
      }))
      return
    }
    await apiClient.fetch('/v1/transactions/bulk/owners', {
      method: 'PATCH',
      body: JSON.stringify({ transactionIds: txnIds, ownerIds }),
    })
    await get().fetchTransactions()
  },
}))

// ─── Local merge helpers ─────────────────────────────────────────────────────

/** Overlay OPFS row scalars onto a store row, preserving joined objects. */
function mergeLocalRow(t: Transaction, row: LocalTransaction | undefined, owners?: TransactionOwner[]): Transaction {
  if (!row) return t
  return {
    ...t,
    accountId: row.accountId,
    statementId: row.statementId,
    date: row.date,
    description: row.description,
    merchant: row.merchant,
    amount: row.amount,
    type: row.type,
    isOneTime: row.isOneTime,
    categoryId: row.categoryId,
    comment: row.comment,
    dedupHash: row.dedupHash,
    updatedAt: new Date().toISOString(),
    ...(owners !== undefined ? { transactionOwners: owners } : {}),
  }
}

function mapShares(txnId: string, shares: OwnerShare[]): TransactionOwner[] {
  return shares.map((s) => ({
    id: `${txnId}:${s.ownerId}`,
    transactionId: txnId,
    ownerId: s.ownerId,
    amount: s.amount,
    percentage: s.percentage,
    owner: { id: s.ownerId, name: s.name, color: s.color ?? 'indigo', isDefault: s.isDefault },
  }))
}

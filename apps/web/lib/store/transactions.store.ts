import { create } from 'zustand'
import { apiClient } from '../api'

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
  transactionOwners: TransactionOwner[]
}

export interface TransactionFilters {
  accountId?: string
  startDate?: string
  endDate?: string
  categoryId?: string
  ownerId?: string
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
    set({ isLoading: true, error: null })

    // Build query string from filters
    const params = new URLSearchParams()
    if (filters.accountId) params.set('accountId', filters.accountId)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.ownerId) params.set('ownerId', filters.ownerId)
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
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}/owners`, {
      method: 'PUT',
      body: JSON.stringify({ ownerIds }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },

  updateTransactionCategory: async (txnId, categoryId) => {
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },

  updateTransactionOneTime: async (txnId, isOneTime) => {
    const updated = await apiClient.fetch<Transaction>(`/v1/transactions/${txnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isOneTime }),
    })

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
    }))
  },
}))

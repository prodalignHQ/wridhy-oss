import { create } from 'zustand'
import { DataAdapter } from './storage-mode'

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
  fetchTransactions: (adapter: DataAdapter) => Promise<void>
  updateTransactionOwners: (adapter: DataAdapter, txnId: string, ownerIds: string[]) => Promise<void>
  updateTransactionCategory: (adapter: DataAdapter, txnId: string, categoryId: string | null) => Promise<void>
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

  fetchTransactions: async (adapter: DataAdapter) => {
    const { filters } = get()
    set({ isLoading: true, error: null })

    try {
      const data = await adapter.getTransactions(filters)

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

  updateTransactionOwners: async (adapter, txnId, ownerIds) => {
    const updated = await adapter.updateTransactionOwners(txnId, ownerIds)

    if (updated) {
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
      }))
    }
  },

  updateTransactionCategory: async (adapter, txnId, categoryId) => {
    const updated = await adapter.updateTransactionCategory(txnId, categoryId)

    if (updated) {
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === txnId ? updated : t)),
      }))
    }
  },
}))

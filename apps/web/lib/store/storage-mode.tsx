"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import {
  MonthlyInsight,
  YearlyInsight,
  CategoryComparison,
  CategoryAverage,
  Account,
  Statement,
  Transaction,
  Category,
  Rule,
  Owner,
  Asset,
  Liability,
  NetWorthSnapshot
} from "@momoney/types"
import { apiClient } from "../api"
import { useAuthStore } from "./auth.store"
import { localDb, initLocalDb } from "./local-db"

type StorageMode = "session" | "local-sqlite" | "cloud"

export interface DataAdapter {
  // Accounts
  getAccounts: () => Promise<Account[]>
  createAccount: (data: any) => Promise<Account>
  deleteAccount: (id: string) => Promise<void>
  
  // Statements
  getStatements: (filters?: any) => Promise<Statement[]>
  deleteStatement: (id: string) => Promise<void>
  previewStatement: (file: File, bankId: string) => Promise<any[]>
  importStatement: (file: File, bankId: string, accountId: string, statementMonth: string) => Promise<{ importedCount: number; duplicatesSkipped: number }>

  // Transactions
  getTransactions: (filters?: any) => Promise<any>
  updateTransactionCategory: (id: string, categoryId: string | null) => Promise<Transaction | null>
  updateTransactionOwners: (id: string, ownerIds: string[]) => Promise<Transaction | null>
  bulkUpdateCategory: (ids: string[], categoryId: string | null) => Promise<{ updatedCount: number }>
  bulkUpdateOwners: (ids: string[], ownerIds: string[]) => Promise<{ updatedCount: number }>

  // Categories
  getCategories: () => Promise<Category[]>
  createCategory: (data: any) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>

  // Owners
  getOwners: () => Promise<Owner[]>
  createOwner: (data: any) => Promise<Owner>
  updateOwner: (id: string, data: any) => Promise<Owner | null>
  deleteOwner: (id: string) => Promise<void>

  // Rules
  getRules: () => Promise<Rule[]>
  createRule: (data: any) => Promise<Rule>
  updateRule: (id: string, data: any) => Promise<Rule | null>
  deleteRule: (id: string) => Promise<void>
  reapplyRules: () => Promise<{ updatedCount: number }>

  // Invoices
  getInvoices: () => Promise<any[]>
  getInvoiceDetail: (id: string) => Promise<any>
  createInvoice: (data: any) => Promise<any>
  updateInvoice: (id: string, data: any) => Promise<any>
  generateInvoice: (id: string) => Promise<any>
  deleteInvoice: (id: string) => Promise<void>

  // Net Worth
  getAssets: () => Promise<Asset[]>
  createAsset: (data: any) => Promise<Asset>
  updateAsset: (id: string, data: any) => Promise<Asset | null>
  deleteAsset: (id: string) => Promise<void>
  getLiabilities: () => Promise<Liability[]>
  createLiability: (data: any) => Promise<Liability>
  updateLiability: (id: string, data: any) => Promise<Liability | null>
  deleteLiability: (id: string) => Promise<void>

  // Insights
  getMonthlyInsights: (month: string, ownerIds?: string[]) => Promise<MonthlyInsight>
  getYearlyInsights: (year: number, ownerIds?: string[]) => Promise<YearlyInsight>
  getCategoryTrends: (year: number, ownerIds?: string[]) => Promise<any[]>
  getCategoryComparison: (month: string, ownerIds?: string[]) => Promise<CategoryComparison>
  getCategoryAverages: (month: string, ownerIds?: string[]) => Promise<CategoryAverage>

  // Additional Net Worth helpers
  getNetworthOverview: () => Promise<any>
  getSnapshots: () => Promise<NetWorthSnapshot[]>
  getDraft: () => Promise<any>
  saveDraft: (data: any) => Promise<void>
  deleteDraft: () => Promise<void>
  createSnapshot: () => Promise<NetWorthSnapshot>
  copySnapshot: (id: string) => Promise<void>
}

// Session Adapter (Local Mode)
const sessionAdapter: DataAdapter = {
  // Accounts
  getAccounts: async () => localDb.accounts.findMany(),
  createAccount: async (data) => localDb.accounts.create(data),
  deleteAccount: async (id) => localDb.accounts.delete(id),

  // Statements
  getStatements: async (f) => localDb.statements.findMany(f?.accountId),
  deleteStatement: async (id) => localDb.statements.delete(id),
  previewStatement: async (file, bankId) => {
    const { getParser } = await import('@momoney/parsers')
    const parser = getParser(bankId)
    if (!parser) throw new Error(`No parser found for bank: ${bankId}`)
    
    const buffer = await file.arrayBuffer()
    return parser.parse(buffer)
  },
  importStatement: async (file, bankId, accountId, statementMonth) => {
    const { getParser } = await import('@momoney/parsers')
    const { categorize } = await import('@momoney/rules-engine')
    
    const parser = getParser(bankId)
    if (!parser) throw new Error(`No parser found for bank: ${bankId}`)
    
    const buffer = await file.arrayBuffer()
    const rawTransactions = await parser.parse(buffer)
    
    const rules = await localDb.rules.findMany()
    const categories = await localDb.categories.findMany()
    
    // Create statement record
    const statement = await localDb.statements.create({
      bankId,
      accountId,
      statementMonth,
      parsedCount: rawTransactions.length,
      importedCount: 0,
      duplicatesSkipped: 0,
      importedAt: new Date().toISOString()
    })

    const transactionsToImport = rawTransactions.map(t => {
      const result = categorize(t, rules as any, categories as any)
      return {
        ...t,
        amount: t.amount.toString(),
        date: t.date.toISOString(),
        accountId,
        statementId: statement.id,
        categoryId: result.categoryId,
        comment: null,
        dedupHash: `${t.date.toISOString()}-${t.amount}-${t.description}` // Simple dedup hash
      }
    })

    const { imported, duplicates } = await localDb.transactions.createMany(transactionsToImport as any)
    
    // Update statement with final counts
    const statements = localDb.statements.findMany()
    const updated = statements.map(s => s.id === statement.id ? { ...s, importedCount: imported, duplicatesSkipped: duplicates } : s)
    localStorage.setItem('momoney_statements', JSON.stringify(updated))

    return { importedCount: imported, duplicatesSkipped: duplicates }
  },

  // Transactions
  getTransactions: async (f) => localDb.transactions.findMany(f),
  updateTransactionCategory: async (id, catId) => localDb.transactions.updateCategory(id, catId),
  updateTransactionOwners: async (id, ownerIds) => localDb.transactions.updateOwners(id, ownerIds),
  bulkUpdateCategory: async (ids, catId) => localDb.transactions.bulkUpdateCategory(ids, catId),
  bulkUpdateOwners: async (ids, ownerIds) => localDb.transactions.bulkUpdateOwners(ids, ownerIds),

  // Categories
  getCategories: async () => localDb.categories.findMany(),
  createCategory: async (data) => localDb.categories.create(data),
  deleteCategory: async (id) => localDb.categories.delete(id),

  // Owners
  getOwners: async () => localDb.owners.findMany(),
  createOwner: async (data) => localDb.owners.create(data),
  updateOwner: async (id, data) => localDb.owners.update(id, data),
  deleteOwner: async (id) => localDb.owners.delete(id),

  // Rules
  getRules: async () => localDb.rules.findMany(),
  createRule: async (data) => localDb.rules.create(data),
  updateRule: async (id, data) => localDb.rules.update(id, data),
  deleteRule: async (id) => localDb.rules.delete(id),
  reapplyRules: async () => {
    const { categorize } = await import('@momoney/rules-engine')
    const rules = await localDb.rules.findMany()
    const categories = await localDb.categories.findMany()
    
    // Fetch ALL transactions without pagination
    const allTxns = localDb.getAll('transactions')
    let updatedCount = 0
    
    const updatedTxns = allTxns.map(t => {
      const result = categorize({
        date: new Date(t.date),
        description: t.description,
        amount: parseFloat(t.amount),
        type: t.type
      } as any, rules as any, categories as any)
      
      if (result.categoryId && result.categoryId !== t.categoryId) {
        updatedCount++
        return { ...t, categoryId: result.categoryId, updatedAt: new Date().toISOString() }
      }
      return t
    })
    
    if (updatedCount > 0) {
      localStorage.setItem('momoney_transactions', JSON.stringify(updatedTxns))
    }
    
    return { updatedCount }
  },

  // Invoices
  getInvoices: async () => localDb.invoices.findMany(),
  getInvoiceDetail: async (id) => localDb.invoices.findById(id),
  createInvoice: async (data) => localDb.invoices.create(data),
  updateInvoice: async (id, data) => localDb.invoices.update(id, data),
  generateInvoice: async (id) => localDb.invoices.generate(id),
  deleteInvoice: async (id) => localDb.invoices.delete(id),

  // Net Worth
  getAssets: async () => localDb.networth.getAssets(),
  createAsset: async (data) => localDb.networth.createAsset(data),
  updateAsset: async (id, data) => localDb.networth.updateAsset(id, data),
  deleteAsset: async (id) => localDb.networth.deleteAsset(id),
  getLiabilities: async () => localDb.networth.getLiabilities(),
  createLiability: async (data) => localDb.networth.createLiability(data),
  updateLiability: async (id, data) => localDb.networth.updateLiability(id, data),
  deleteLiability: async (id) => localDb.networth.deleteLiability(id),

  // Insights
  getMonthlyInsights: async (month, ownerIds) => {
    const allTxns = localDb.getAll('transactions')
    const categories = await localDb.categories.findMany()
    
    // Filter by month (YYYY-MM) and optionally owners
    const filtered = allTxns.filter(t => {
      const isMonthMatch = t.date.startsWith(month)
      if (!isMonthMatch) return false
      
      if (ownerIds && ownerIds.length > 0) {
        return (t.owners || []).some(o => ownerIds.includes(o.ownerId))
      }
      return true
    })

    let totalSpend = 0
    let totalIncome = 0
    const catMap: Record<string, number> = {}
    const merchantMap: Record<string, number> = {}
    let uncategorizedCount = 0

    filtered.forEach(t => {
      const amount = parseFloat(t.amount)
      if (t.type === 'debit') {
        totalSpend += amount
        if (t.categoryId) {
          catMap[t.categoryId] = (catMap[t.categoryId] || 0) + amount
        } else {
          uncategorizedCount++
        }
        
        const m = t.merchant || t.description
        merchantMap[m] = (merchantMap[m] || 0) + amount
      } else {
        totalIncome += amount
      }
    })

    const topCategories = Object.entries(catMap)
      .map(([id, amount]) => ({
        id,
        name: categories.find(c => c.id === id)?.name || 'Unknown',
        amount: amount.toString(),
        color: categories.find(c => c.id === id)?.color || '#ccc'
      }))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5)

    const topMerchants = Object.entries(merchantMap)
      .map(([name, amount]) => ({
        name,
        amount: amount.toString()
      }))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5)

    return {
      totalSpend: totalSpend.toString(),
      totalIncome: totalIncome.toString(),
      netFlow: (totalIncome - totalSpend).toString(),
      topCategories,
      topMerchants,
      uncategorizedCount
    }
  },
  getYearlyInsights: async (year, ownerIds) => {
    const allTxns = localDb.getAll('transactions')
    
    const monthlyData: Record<number, { income: number, spend: number }> = {}
    for (let i = 0; i < 12; i++) monthlyData[i] = { income: 0, spend: 0 }

    allTxns.forEach(t => {
      const d = new Date(t.date)
      if (d.getFullYear() === year) {
        if (ownerIds && ownerIds.length > 0) {
          const hasOwner = (t.owners || []).some((o: any) => ownerIds.includes(o.ownerId))
          if (!hasOwner) return
        }
        
        const month = d.getMonth()
        const amount = parseFloat(t.amount)
        if (t.type === 'debit') {
          monthlyData[month].spend += amount
        } else {
          monthlyData[month].income += amount
        }
      }
    })

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return Object.entries(monthlyData).map(([m, data]) => ({
      month: months[parseInt(m)],
      income: data.income.toString(),
      spend: data.spend.toString(),
      net: (data.income - data.spend).toString()
    })) as any
  },
  getCategoryTrends: async () => [],
  getCategoryComparison: async (month, ownerIds) => {
    const allTxns = localDb.getAll('transactions')
    const categories = await localDb.categories.findMany()
    
    const currentMonth = month
    const prevMonthDate = new Date(month + '-01')
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
    const prevMonth = prevMonthDate.toISOString().slice(0, 7)

    const compute = (m: string) => {
      const filtered = allTxns.filter(t => {
        if (!t.date.startsWith(m) || t.type !== 'debit' || !t.categoryId) return false
        if (ownerIds && ownerIds.length > 0) {
          return (t.owners || []).some((o: any) => ownerIds.includes(o.ownerId))
        }
        return true
      })
      const map: Record<string, number> = {}
      filtered.forEach(t => {
        map[t.categoryId!] = (map[t.categoryId!] || 0) + parseFloat(t.amount)
      })
      return map
    }

    const currentMap = compute(currentMonth)
    const prevMap = compute(prevMonth)

    return categories.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      currentAmount: (currentMap[c.id] || 0).toString(),
      previousAmount: (prevMap[c.id] || 0).toString(),
      change: prevMap[c.id] ? (((currentMap[c.id] || 0) - prevMap[c.id]) / prevMap[c.id] * 100).toString() : '0'
    })).filter(c => parseFloat(c.currentAmount) > 0 || parseFloat(c.previousAmount) > 0) as any
  },
  getCategoryAverages: async (month, ownerIds) => {
    const allTxns = localDb.getAll('transactions')
    const categories = await localDb.categories.findMany()
    
    const currentMonth = month
    const filtered = allTxns.filter(t => {
      if (t.type !== 'debit' || !t.categoryId) return false
      if (ownerIds && ownerIds.length > 0) {
        return (t.owners || []).some((o: any) => ownerIds.includes(o.ownerId))
      }
      return true
    })

    const catTotals: Record<string, number> = {}
    const currentTotals: Record<string, number> = {}
    
    filtered.forEach(t => {
      const amount = parseFloat(t.amount)
      catTotals[t.categoryId!] = (catTotals[t.categoryId!] || 0) + amount
      if (t.date.startsWith(currentMonth)) {
        currentTotals[t.categoryId!] = (currentTotals[t.categoryId!] || 0) + amount
      }
    })

    return categories.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      currentAmount: (currentTotals[c.id] || 0).toString(),
      averageAmount: ((catTotals[c.id] || 0) / 12).toString()
    })).filter(c => parseFloat(c.currentAmount) > 0 || parseFloat(c.averageAmount) > 0) as any
  },

  getNetworthOverview: async () => localDb.networth.getOverview(),
  getSnapshots: async () => localDb.networth.getSnapshots(),
  getDraft: async () => localDb.networth.getDraft(),
  saveDraft: async (d) => localDb.networth.saveDraft(d),
  deleteDraft: async () => localDb.networth.deleteDraft(),
  createSnapshot: async () => localDb.networth.createSnapshot(),
  copySnapshot: async (id) => {
    // Basic mock... not strictly needed locally 
  }
}

// Cloud Adapter implementation
const cloudAdapter: DataAdapter = {
  // Accounts
  getAccounts: async () => apiClient.fetch("/v1/accounts"),
  createAccount: async (data) => apiClient.fetch("/v1/accounts", { method: "POST", body: data }),
  deleteAccount: async (id) => apiClient.fetch(`/v1/accounts/${id}`, { method: "DELETE" }),

  // Statements
  getStatements: async (filters) => {
    const params = new URLSearchParams(filters)
    return apiClient.fetch(`/v1/statements?${params.toString()}`)
  },
  deleteStatement: async (id) => apiClient.fetch(`/v1/statements/${id}`, { method: "DELETE" }),

  // Transactions
  getTransactions: async (filters) => {
    const params = new URLSearchParams(filters)
    return apiClient.fetch(`/v1/transactions?${params.toString()}`)
  },
  updateTransactionCategory: async (id, categoryId) => 
    apiClient.fetch(`/v1/transactions/${id}/category`, { method: "PATCH", body: JSON.stringify({ categoryId }) }),
  updateTransactionOwners: async (id, ownerIds) => 
    apiClient.fetch(`/v1/transactions/${id}/owners`, { method: "PATCH", body: JSON.stringify({ ownerIds }) }),
  bulkUpdateCategory: async (ids, categoryId) => 
    apiClient.fetch("/v1/transactions/bulk/category", { method: "PATCH", body: JSON.stringify({ transactionIds: ids, categoryId }) }),
  bulkUpdateOwners: async (ids, ownerIds) => 
    apiClient.fetch("/v1/transactions/bulk/owners", { method: "PATCH", body: JSON.stringify({ transactionIds: ids, ownerIds }) }),

  // Categories
  getCategories: async () => apiClient.fetch("/v1/categories"),
  createCategory: async (data) => apiClient.fetch("/v1/categories", { method: "POST", body: JSON.stringify(data) }),
  deleteCategory: async (id) => apiClient.fetch(`/v1/categories/${id}`, { method: "DELETE" }),

  // Owners
  getOwners: async () => apiClient.fetch("/v1/owners"),
  createOwner: async (data) => apiClient.fetch("/v1/owners", { method: "POST", body: JSON.stringify(data) }),
  updateOwner: async (id, data) => apiClient.fetch(`/v1/owners/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteOwner: async (id) => apiClient.fetch(`/v1/owners/${id}`, { method: "DELETE" }),

  // Rules
  getRules: async () => apiClient.fetch("/v1/rules"),
  createRule: async (data) => apiClient.fetch("/v1/rules", { method: "POST", body: JSON.stringify(data) }),
  updateRule: async (id, data) => apiClient.fetch(`/v1/rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRule: async (id) => apiClient.fetch(`/v1/rules/${id}`, { method: "DELETE" }),
  reapplyRules: async () => apiClient.fetch("/v1/rules/reapply", { method: "POST" }),

  // Invoices
  getInvoices: async () => apiClient.fetch("/v1/invoices"),
  getInvoiceDetail: async (id) => apiClient.fetch(`/v1/invoices/${id}`),
  createInvoice: async (data) => apiClient.fetch("/v1/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: async (id, data) => apiClient.fetch(`/v1/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  generateInvoice: async (id) => apiClient.fetch(`/v1/invoices/${id}/generate`, { method: "POST" }),
  deleteInvoice: async (id) => apiClient.fetch(`/v1/invoices/${id}`, { method: "DELETE" }),

  // Net Worth
  getAssets: async () => apiClient.fetch("/v1/networth/assets"),
  createAsset: async (data) => apiClient.fetch("/v1/networth/assets", { method: "POST", body: JSON.stringify(data) }),
  updateAsset: async (id, data) => apiClient.fetch(`/v1/networth/assets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAsset: async (id) => apiClient.fetch(`/v1/networth/assets/${id}`, { method: "DELETE" }),
  getLiabilities: async () => apiClient.fetch("/v1/networth/liabilities"),
  createLiability: async (data) => apiClient.fetch("/v1/networth/liabilities", { method: "POST", body: JSON.stringify(data) }),
  updateLiability: async (id, data) => apiClient.fetch(`/v1/networth/liabilities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLiability: async (id) => apiClient.fetch(`/v1/networth/liabilities/${id}`, { method: "DELETE" }),
  getMonthlyInsights: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/monthly?${params.toString()}`)
  },
  getYearlyInsights: async (year, ownerIds) => {
    const params = new URLSearchParams({ year: String(year) })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/yearly?${params.toString()}`)
  },
  getCategoryTrends: async (year, ownerIds) => {
    const params = new URLSearchParams({ year: String(year) })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-trends?${params.toString()}`)
  },
    getCategoryComparison: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-comparison?${params.toString()}`)
  },
  getCategoryAverages: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-averages?${params.toString()}`)
  },
  getNetworthOverview: async () => apiClient.fetch("/v1/networth"),
  getSnapshots: async () => apiClient.fetch("/v1/networth/history"),
  getDraft: async () => apiClient.fetch("/v1/networth/draft").catch(() => null),
  saveDraft: async (data: any) => apiClient.fetch("/v1/networth/draft", { method: "PUT", body: JSON.stringify(data) }),
  deleteDraft: async () => apiClient.fetch("/v1/networth/draft", { method: "DELETE" }),
  createSnapshot: async () => apiClient.fetch("/v1/networth/snapshot", { method: "POST" }),
  copySnapshot: async (id: string) => apiClient.fetch(`/v1/networth/snapshot/${id}/copy`, { method: "POST" }),
}

interface StorageModeContextValue {
  mode: StorageMode
  setMode: (mode: StorageMode) => void
  adapter: DataAdapter
}

const StorageModeContext = React.createContext<StorageModeContextValue>({
  mode: "session",
  setMode: () => {},
  adapter: sessionAdapter,
})

export function StorageModeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const [mode, setModeState] = useState<StorageMode>("session")

  // Initialize from localStorage on mount
  useEffect(() => {
    initLocalDb()
    
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("momoney_storage_mode") as StorageMode
      
      if (user) {
        // If logged in, we generally want cloud mode unless they've explicitly switched to something else
        // during THIS session. But to stay safe, we default to cloud if no persistent preference or session
        if (!saved || saved === "session") {
          setModeState("cloud")
        } else {
          setModeState(saved)
        }
      } else if (saved) {
        setModeState(saved)
      }
    }
  }, [user])

  const setMode = (newMode: StorageMode) => {
    setModeState(newMode)
    if (typeof window !== "undefined") {
      localStorage.setItem("momoney_storage_mode", newMode)
    }
  }

  const adapter = mode === "cloud" ? cloudAdapter : sessionAdapter

  return (
    <StorageModeContext.Provider value={{ mode, setMode, adapter }}>
      {children}
    </StorageModeContext.Provider>
  )
}

export const useStorageMode = () => useContext(StorageModeContext)

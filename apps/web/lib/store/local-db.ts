import {
  Account,
  Statement,
  Transaction,
  Category,
  Rule,
  Owner,
  Asset,
  Liability,
  NetWorthSnapshot
} from '@momoney/types'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from './default-categories'

// ─── Constants & Types ────────────────────────────────────────────────────────

const PREFIX = 'momoney_'

export interface LocalStorageSchema {
  accounts: Account[]
  statements: Statement[]
  transactions: Transaction[]
  categories: Category[]
  rules: Rule[]
  owners: Owner[]
  assets: Asset[]
  liabilities: Liability[]
  nw_snapshots: NetWorthSnapshot[]
  invoices: any[]
  invoice_items: any[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInvoiceAnalysis(transactionsList: any[]) {
  const ownerTotals = new Map<string, any>()

  for (const transaction of transactionsList) {
    if (transaction.type !== 'debit' && transaction.type !== 'credit') continue

    const categoryName = transaction.category?.name ?? 'Uncategorized'
    const categoryId = transaction.category?.id ?? null

    for (const owner of (transaction.owners || [])) {
      const ownerKey = owner.ownerId ?? owner.name
      const amount = parseFloat(owner.amount)

      if (!ownerTotals.has(ownerKey)) {
        ownerTotals.set(ownerKey, {
          ownerId: owner.ownerId,
          name: owner.name,
          color: owner.color,
          total: 0,
          categories: new Map(),
        })
      }

      const ownerBucket = ownerTotals.get(ownerKey)!
      ownerBucket.total += amount

      const categoryKey = `${categoryId ?? 'uncategorized'}:${categoryName}`
      if (!ownerBucket.categories.has(categoryKey)) {
        ownerBucket.categories.set(categoryKey, {
          categoryId,
          category: categoryName,
          total: 0,
        })
      }

      ownerBucket.categories.get(categoryKey)!.total += amount
    }
  }

  const ownerBreakdown = Array.from(ownerTotals.values())
    .map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
      categories: Array.from(owner.categories.values()).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total)

  return {
    ownerTotals: ownerBreakdown.map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
    })),
    ownerCategoryTotals: ownerBreakdown,
  }
}

// ─── Core Helpers ─────────────────────────────────────────────────────────────

function getStorage<K extends keyof LocalStorageSchema>(key: K): LocalStorageSchema[K] {
  if (typeof window === 'undefined') return [] as any
  const val = localStorage.getItem(`${PREFIX}${key}`)
  return val ? JSON.parse(val) : []
}

function setStorage<K extends keyof LocalStorageSchema>(key: K, data: LocalStorageSchema[K]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data))
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initLocalDb() {
  if (typeof window === 'undefined') return
  
  // Seed default categories if none exist
  const existingCategories = getStorage('categories')
  if (existingCategories.length === 0) {
    const categoriesWithDbReqs: Category[] = DEFAULT_CATEGORIES.map(c => ({
      ...c,
      userId: null,
      parentId: null,
      isSystem: true,
      createdAt: new Date()
    }))
    setStorage('categories', categoriesWithDbReqs)
  }

  // Seed default rules if none exist
  const existingRules = getStorage('rules')
  if (existingRules.length === 0) {
    const rulesWithDbReqs = DEFAULT_RULES.map(r => ({
      ...r,
      id: uuidv4(),
      userId: null,
      source: 'system',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Rule))
    setStorage('rules', rulesWithDbReqs)
  }
}

// ─── DB Operations ────────────────────────────────────────────────────────────

export const localDb = {
  // --- Generic ---
  getAll: <K extends keyof LocalStorageSchema>(table: K) => getStorage(table),
  
  clearAll: () => {
    if (typeof window === 'undefined') return
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key)
    })
    initLocalDb()
  },

  // --- Accounts ---
  accounts: {
    findMany: () => getStorage('accounts').filter(a => !a.isDeleted).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (data: Omit<Account, 'id' | 'userId' | 'isDeleted' | 'createdAt' | 'updatedAt'>) => {
      const accounts = getStorage('accounts')
      const newAccount: Account = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
        isDeleted: false,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      }
      setStorage('accounts', [...accounts, newAccount])
      return newAccount
    },
    delete: (id: string) => {
      const accounts = getStorage('accounts')
      setStorage('accounts', accounts.map(a => a.id === id ? { ...a, isDeleted: true, updatedAt: new Date() as any } : a))
    }
  },

  // --- Statements ---
  statements: {
    findMany: (accountId?: string) => {
      let statements = getStorage('statements')
      if (accountId) statements = statements.filter(s => s.accountId === accountId)
      
      const accounts = getStorage('accounts')
      
      return statements.map(s => ({
        ...s,
        account: accounts.find(a => a.id === s.accountId) || null
      })).sort((a,b) => new Date((b as any).importedAt || new Date()).getTime() - new Date((a as any).importedAt || new Date()).getTime())
    },
    create: (data: Omit<Statement, 'id' | 'userId'>) => {
      const statements = getStorage('statements')
      const newStatement: Statement = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
      }
      setStorage('statements', [...statements, newStatement])
      return newStatement
    },
    delete: (id: string) => {
      const statements = getStorage('statements')
      setStorage('statements', statements.filter(s => s.id !== id))
      // Cascade delete transactions
      const transactions = getStorage('transactions')
      setStorage('transactions', transactions.filter(t => t.statementId !== id))
    }
  },

  // --- Transactions ---
  transactions: {
    findMany: (filters?: Record<string, string | number>) => {
      let txns = getStorage('transactions')
      
      if (filters?.accountId) txns = txns.filter(t => t.accountId === filters.accountId)
      if (filters?.categoryId) txns = txns.filter(t => t.categoryId === filters.categoryId)
      if (filters?.startDate) txns = txns.filter(t => new Date(t.date) >= new Date(filters.startDate))
      if (filters?.endDate) txns = txns.filter(t => new Date(t.date) <= new Date(filters.endDate))
      if (filters?.search) {
        const s = String(filters.search).toLowerCase()
        txns = txns.filter(t => t.description.toLowerCase().includes(s))
      }
      
      // Handle owners
      if (filters?.ownerId) {
        txns = txns.filter(t => (t.owners || []).some(o => o.ownerId === filters.ownerId))
      }

      // Join categories and owners for UI
      const categories = getStorage('categories')
      const owners = getStorage('owners')
      
      txns = txns.map(t => ({
        ...t,
        category: t.categoryId ? categories.find(c => c.id === t.categoryId) || null : null,
        transactionOwners: (t.owners || []).map(to => ({
           ...to,
           owner: owners.find(o => o.id === to.ownerId) || null
        }))
      })) as Transaction[]

      // Sort
      txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Paginate
      const page = Number(filters?.page) || 1
      const limit = Number(filters?.limit) || 50
      const offset = (page - 1) * limit
      
      return {
        transactions: txns.slice(offset, offset + limit),
        total: txns.length,
        page,
        limit,
        totalPages: Math.ceil(txns.length / limit)
      }
    },
    createMany: (dataArray: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]) => {
      const txns = getStorage('transactions')
      let imported = 0
      let duplicates = 0
      
      const newTxns = dataArray.reduce((acc, data) => {
        // Simple dedup
        const exists = txns.some(t => t.dedupHash === data.dedupHash) || acc.some(t => t.dedupHash === data.dedupHash)
        if (exists) {
          duplicates++
          return acc
        }
        imported++
        acc.push({
          ...data,
          id: uuidv4(),
          userId: 'local-user',
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        } as Transaction)
        return acc
      }, [] as Transaction[])

      if (newTxns.length > 0) {
        setStorage('transactions', [...txns, ...newTxns])
      }
      
      return { imported, duplicates }
    },
    updateCategory: (id: string, categoryId: string | null) => {
      const txns = getStorage('transactions')
      let updated: Transaction | null = null
      setStorage('transactions', txns.map(t => {
        if (t.id === id) {
          updated = { ...t, categoryId, updatedAt: new Date() as any }
          return updated
        }
        return t
      }))
      
      // Hydrate for return
      if (updated) {
        const c = getStorage('categories').find(category => category.id === categoryId)
        ;(updated as Transaction).category = c || null
      }
      return updated
    },
    updateOwners: (id: string, ownerIds: string[]) => {
       const txns = getStorage('transactions')
       const owners = getStorage('owners')
       let updated: Transaction | null = null
       
       setStorage('transactions', txns.map(t => {
         if (t.id === id) {
           const amount = parseFloat(t.amount)
           const shareAmount = (amount / ownerIds.length).toFixed(2)
           const sharePercent = (100 / ownerIds.length).toFixed(2)
           
           const transactionOwners = ownerIds.map(oId => ({
             id: uuidv4(),
             transactionId: id,
             ownerId: oId,
             amount: shareAmount,
             percentage: sharePercent
           }))
           
           updated = { ...t, owners: transactionOwners, updatedAt: new Date() as any }
           return updated
         }
         return t
       }))
       
       // Hydrate
       if (updated) {
         ;(updated as Transaction).owners = ((updated as Transaction).owners || []).map(o => ({
           ...o,
           owner: owners.find(ow => ow.id === o.ownerId) || null
         }))
       }
       return updated
    },
    bulkUpdateCategory: (ids: string[], categoryId: string | null) => {
       const txns = getStorage('transactions')
       let count = 0
       setStorage('transactions', txns.map(t => {
         if (ids.includes(t.id)) {
           count++
           return { ...t, categoryId, updatedAt: new Date() as any }
         }
         return t
       }))
       return { updatedCount: count }
    },
    bulkUpdateOwners: (ids: string[], ownerIds: string[]) => {
      const txns = getStorage('transactions')
      let count = 0
      setStorage('transactions', txns.map(t => {
         if (ids.includes(t.id)) {
           count++
           const amount = parseFloat(t.amount)
           const shareAmount = (amount / ownerIds.length).toFixed(2)
           const sharePercent = (100 / ownerIds.length).toFixed(2)
           
           const transactionOwners = ownerIds.map(oId => ({
             id: uuidv4(),
             transactionId: t.id,
             ownerId: oId,
             amount: shareAmount,
             percentage: sharePercent
           }))
           
           return { ...t, owners: transactionOwners, updatedAt: new Date() as any }
         }
         return t
       }))
       return { updatedCount: count }
    }
  },

  // --- Categories ---
  categories: {
    findMany: () => getStorage('categories'),
    create: (data: Omit<Category, 'id' | 'userId' | 'isSystem' | 'createdAt'>) => {
      const categories = getStorage('categories')
      const newCategory: Category = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
        isSystem: false,
        createdAt: new Date() as any,
      }
      setStorage('categories', [...categories, newCategory])
      return newCategory
    },
    delete: (id: string) => {
      const categories = getStorage('categories')
      setStorage('categories', categories.filter(c => c.id !== id))
    }
  },
  
  // --- Owners ---
  owners: {
    findMany: () => getStorage('owners').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    create: (data: Omit<Owner, 'id' | 'userId' | 'isDefault' | 'createdAt'>) => {
       const owners = getStorage('owners')
       const isFirst = owners.length === 0
       const newOwner: Owner = {
         ...data,
         id: uuidv4(),
         userId: 'local-user',
         isDefault: isFirst,
         createdAt: new Date() as any
       }
       setStorage('owners', [...owners, newOwner])
       return newOwner
    },
    update: (id: string, data: Partial<Owner>) => {
      let updated: Owner | null = null
      const owners = getStorage('owners')
      setStorage('owners', owners.map(o => {
        if (o.id === id) {
          updated = { ...o, ...data }
          return updated
        }
        return o
      }))
      return updated
    },
    delete: (id: string) => {
      const owners = getStorage('owners')
      setStorage('owners', owners.filter(o => o.id !== id))
      // Also clean up transaction owners
      const txns = getStorage('transactions')
      setStorage('transactions', txns.map(t => {
        if (t.owners && t.owners.some(o => o.ownerId === id)) {
          return { ...t, owners: t.owners.filter(o => o.ownerId !== id) }
        }
        return t
      }))
    }
  },

  // --- Rules ---
  rules: {
    findMany: () => getStorage('rules').sort((a,b) => a.priority - b.priority),
    create: (data: Omit<Rule, 'id' | 'userId' | 'source' | 'createdAt' | 'updatedAt'>) => {
      const rules = getStorage('rules')
      const newRule: Rule = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
        source: 'user',
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      }
      setStorage('rules', [...rules, newRule])
      return newRule
    },
    update: (id: string, data: Partial<Rule>) => {
      let updated: Rule | null = null
      const rules = getStorage('rules')
      setStorage('rules', rules.map(r => {
        if (r.id === id) {
          updated = { ...r, ...data, updatedAt: new Date() as any }
          return updated
        }
        return r
      }))
      return updated
    },
    delete: (id: string) => {
      const rules = getStorage('rules')
      setStorage('rules', rules.filter(r => r.id !== id))
    }
  },
  
  // --- Net Worth ---
  networth: {
    getAssets: () => getStorage('assets').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    createAsset: (data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      const assets = getStorage('assets')
      const newAsset: Asset = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      }
      setStorage('assets', [...assets, newAsset])
      return newAsset
    },
    updateAsset: (id: string, data: Partial<Asset>) => {
      let updated: Asset | null = null
      setStorage('assets', getStorage('assets').map(a => {
        if (a.id === id) {
          updated = { ...a, ...data, updatedAt: new Date() as any }
          return updated
        }
        return a
      }))
      return updated
    },
    deleteAsset: (id: string) => setStorage('assets', getStorage('assets').filter(a => a.id !== id)),

    getLiabilities: () => getStorage('liabilities').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    createLiability: (data: Omit<Liability, 'id' | 'userId' | 'createdAt'>) => {
      const liabilities = getStorage('liabilities')
      const newLiability: Liability = {
        ...data,
        id: uuidv4(),
        userId: 'local-user',
        createdAt: new Date() as any,
      }
      setStorage('liabilities', [...liabilities, newLiability])
      return newLiability
    },
    updateLiability: (id: string, data: Partial<Liability>) => {
      let updated: Liability | null = null
      setStorage('liabilities', getStorage('liabilities').map(l => {
        if (l.id === id) {
          updated = { ...l, ...data }
          return updated
        }
        return l
      }))
      return updated
    },
    deleteLiability: (id: string) => setStorage('liabilities', getStorage('liabilities').filter(l => l.id !== id)),
    
    getSnapshots: () => getStorage('nw_snapshots').sort((a,b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime()),
    
    // Aggregation logic for Net Worth overview
    getOverview: () => {
      const assets = getStorage('assets')
      const liabilities = getStorage('liabilities')
      
      const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.value), 0)
      const totalLiabilities = liabilities.reduce((sum, l) => sum + parseFloat(l.outstandingAmount), 0)
      
      return {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        assets,
        liabilities
      }
    },
    
    // Drafts (Stored loosely in localStorage for now instead of full DB table if we want, or just mock memory)
    getDraft: () => {
      const d = localStorage.getItem(`${PREFIX}nw_draft`)
      return d ? JSON.parse(d) : null
    },
    saveDraft: (data: any) => {
      localStorage.setItem(`${PREFIX}nw_draft`, JSON.stringify({ ...data, savedAt: new Date().toISOString() }))
    },
    deleteDraft: () => {
      localStorage.removeItem(`${PREFIX}nw_draft`)
    },
    
    createSnapshot: () => {
       const assets = getStorage('assets')
       const liabilities = getStorage('liabilities')
       const snapshots = getStorage('nw_snapshots')
       
       const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.value), 0)
       const totalLiabilities = liabilities.reduce((sum, l) => sum + parseFloat(l.outstandingAmount), 0)
       
       const newSnapshot: NetWorthSnapshot = {
         id: uuidv4(),
         userId: 'local-user',
         snapshotDate: new Date() as any,
         totalAssets: totalAssets.toString(),
         totalLiabilities: totalLiabilities.toString(),
         netWorth: (totalAssets - totalLiabilities).toString(),
         assetBreakdown: null,
         liabilityBreakdown: null,
         notes: null,
         createdAt: new Date() as any,
       }
       
       setStorage('nw_snapshots', [...snapshots, newSnapshot])
       localStorage.removeItem(`${PREFIX}nw_draft`)
       return newSnapshot
    }
  },

  // --- Invoices ---
  invoices: {
    findMany: () => {
       const invs = getStorage('invoices')
       const invStatements = getStorage('statements') // To join account info
       const accounts = getStorage('accounts')
       
       return invs.map(inv => ({
         ...inv,
         statements: (inv.statementIds || []).map((sId: string) => {
           const s = invStatements.find(st => st.id === sId)
           const acc = s ? accounts.find(a => a.id === s.accountId) : null
           return {
             id: sId,
             statementId: sId,
             accountId: s?.accountId,
             statementMonth: s?.statementMonth,
             accountName: acc?.accountName || 'Unknown',
             accountType: acc?.accountType || 'Unknown'
           }
         })
       })).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    },
    
    findById: (id: string) => {
       const invoices = getStorage('invoices')
       const inv = invoices.find(i => i.id === id)
       if (!inv) return null

       const invStatements = getStorage('statements')
       const accounts = getStorage('accounts')
       const categories = getStorage('categories')
       const owners = getStorage('owners')

       const serializedInv = {
         ...inv,
         statements: (inv.statementIds || []).map((sId: string) => {
           const s = invStatements.find(st => st.id === sId)
           const acc = s ? accounts.find(a => a.id === s.accountId) : null
           return {
             id: sId,
             statementId: sId,
             accountId: s?.accountId,
             statementMonth: s?.statementMonth,
             accountName: acc?.accountName || 'Unknown',
             accountType: acc?.accountType || 'Unknown'
           }
         })
       }

       if (inv.status === 'draft') {
         // Load live transactions
         const allTxns = getStorage('transactions')
         const liveTxns = allTxns.filter(t => (inv.statementIds || []).includes(t.statementId))
           .map(t => ({
             ...t,
             category: t.categoryId ? categories.find(c => c.id === t.categoryId) || null : null,
             owners: (t.owners || []).map((to: any) => ({
                ...to,
                name: owners.find(o => o.id === to.ownerId)?.name || 'Unknown',
                color: owners.find(o => o.id === to.ownerId)?.color || null
             }))
           }))
         
         return {
           ...serializedInv,
           transactions: liveTxns,
           analysis: null
         }
       } else {
         // Load stored invoice items
         const allItems = getStorage('invoice_items')
         const items = allItems.filter(item => item.invoiceId === id)
         return {
           ...serializedInv,
           transactions: items,
           analysis: buildInvoiceAnalysis(items)
         }
       }
    },

    create: (data: { name: string, invoiceMonth: string, statementIds: string[] }) => {
       const invoices = getStorage('invoices')
       const newInv = {
         id: uuidv4(),
         userId: 'local-user',
         name: data.name,
         invoiceMonth: data.invoiceMonth,
         statementIds: data.statementIds,
         status: 'draft',
         generatedAt: null,
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString()
       }
       setStorage('invoices', [...invoices, newInv])
       return newInv
    },

    update: (id: string, data: { name?: string, statementIds?: string[] }) => {
       const invoices = getStorage('invoices')
       let updated: any = null
       setStorage('invoices', invoices.map(inv => {
         if (inv.id === id) {
           updated = { ...inv, ...data, updatedAt: new Date().toISOString() }
           return updated
         }
         return inv
       }))
       return updated
    },

    generate: (id: string) => {
       const invoices = getStorage('invoices')
       const categories = getStorage('categories')
       const owners = getStorage('owners')
       
       const inv = invoices.find(i => i.id === id)
       if (!inv || inv.status !== 'draft') return null

       const allTxns = getStorage('transactions')
       const liveTxns = allTxns.filter(t => (inv.statementIds || []).includes(t.statementId))
         .map(t => ({
            id: uuidv4(), // Stored item ID
            invoiceId: id,
            transactionId: t.id,
            statementId: t.statementId,
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            categoryId: t.categoryId,
            category: t.categoryId ? categories.find(c => c.id === t.categoryId) || null : null,
            owners: (t.owners || []).map((to: any) => ({
               ...to,
               name: owners.find(o => o.id === to.ownerId)?.name || 'Unknown',
               color: owners.find(o => o.id === to.ownerId)?.color || null
            }))
         }))

       const items = getStorage('invoice_items')
       setStorage('invoice_items', [...items, ...liveTxns])

       let updated: any = null
       setStorage('invoices', invoices.map(i => {
         if (i.id === id) {
           updated = { ...i, status: 'generated', generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
           return updated
         }
         return i
       }))

       return updated
    },

    delete: (id: string) => {
       const invoices = getStorage('invoices')
       setStorage('invoices', invoices.filter(i => i.id !== id))
       const items = getStorage('invoice_items')
       setStorage('invoice_items', items.filter(item => item.invoiceId !== id))
    }
  }
}

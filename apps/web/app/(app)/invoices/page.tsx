'use client'

import { useState, useEffect, useMemo } from 'react'
import { Receipt, ChevronDown, ChevronUp, User, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  color?: string
}

interface Owner {
  id: string
  name: string
  color?: string
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  categoryId: string | null
  category?: { id: string; name: string; color?: string } | null
  transactionOwners?: { ownerId: string; amount: string; percentage: string; owner: { id: string; name: string } }[]
}

interface Statement {
  id: string
  statementMonth: string
  accountId: string
  importedCount: number
  account: { accountName: string; accountType: string }
}

interface CategoryGroup {
  name: string
  total: number
  count: number
  transactions: Transaction[]
}

// ─── Format helpers ─────────────────────────────────────────────────────────

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Math.abs(value))

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Fetch all data
  useEffect(() => {
    Promise.all([
      apiClient.fetch<{ transactions: Transaction[] }>('/v1/transactions?limit=10000'),
      apiClient.fetch<Statement[]>('/v1/statements'),
      apiClient.fetch<Category[]>('/v1/categories'),
      apiClient.fetch<Owner[]>('/v1/owners'),
    ])
      .then(([txnsRes, stmts, cats, owns]) => {
        console.log('Fetched statements:', stmts)
        setTransactions(txnsRes.transactions || [])
        setStatements(stmts)
        setCategories(cats)
        setOwners(owns)

        // Set default month to current month or latest statement month
        if (stmts.length > 0) {
          const months = stmts.map((s: Statement) => s.statementMonth).sort()
          setSelectedMonth(months[months.length - 1])
        } else {
          const now = new Date()
          setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch data:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Filter transactions by selected month (based on statement's statementMonth)
  const transactionsForMonth = useMemo(() => {
    if (!selectedMonth) return []
    return transactions.filter(t => {
      const txnDate = new Date(t.date)
      const txnMonth = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`
      return txnMonth === selectedMonth
    })
  }, [transactions, selectedMonth])

  // Get available months from statements
  const availableMonths = useMemo(() => {
    const months = new Set(statements.map(s => s.statementMonth.slice(0, 7)))
    return Array.from(months).sort().reverse()
  }, [statements])

  // Group by owner
  const byOwner = useMemo(() => {
    const grouped: Record<string, { total: number; transactions: Transaction[] }> = {}
    for (const owner of owners) {
      const ownerTxns = transactionsForMonth.filter(t => 
        t.transactionOwners?.some(o => o.owner.id === owner.id)
      )
      if (ownerTxns.length > 0) {
        const total = ownerTxns.reduce((sum, t) => {
          const ownerShare = t.transactionOwners?.find(o => o.owner.id === owner.id)
          return sum + (ownerShare ? parseFloat(ownerShare.amount) : t.amount)
        }, 0)
        grouped[owner.id] = { total, transactions: ownerTxns }
      }
    }
    return grouped
  }, [transactionsForMonth, owners])

  // Group by category
  const byCategory = useMemo((): CategoryGroup[] => {
    const grouped: Record<string, CategoryGroup> = {}
    for (const txn of transactionsForMonth) {
      const catId = txn.categoryId || 'uncategorized'
      const catName = txn.category?.name || 'Uncategorized'
      if (!grouped[catId]) {
        grouped[catId] = { name: catName, total: 0, count: 0, transactions: [] }
      }
      grouped[catId].total += txn.type === 'debit' ? txn.amount : 0
      grouped[catId].count += 1
      grouped[catId].transactions.push(txn)
    }
    return Object.values(grouped).sort((a, b) => b.total - a.total)
  }, [transactionsForMonth])

  // Overall totals
  const totals = useMemo(() => {
    const debitTotal = transactionsForMonth
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0)
    const creditTotal = transactionsForMonth
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    return { debit: debitTotal, credit: creditTotal, net: debitTotal - creditTotal }
  }, [transactionsForMonth])

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev)
      if (next.has(ownerId)) next.delete(ownerId)
      else next.add(ownerId)
      return next
    })
  }

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track spending by owner and category</p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-zinc-400">Select month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {availableMonths.length === 0 ? (
            <option value="">No statements yet</option>
          ) : (
            availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))
          )}
        </select>
        <span className="text-xs text-zinc-500">({statements.length} statements loaded)</span>
      </div>

      {/* Statements included in this month */}
      {selectedMonth && statements.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-2">Statements included in {formatMonth(selectedMonth)}:</p>
          <div className="flex flex-wrap gap-2">
            {statements
              .filter(s => s.statementMonth.startsWith(selectedMonth))
              .map(s => (
                <span key={s.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {s.account.accountName}
                </span>
              ))}
          </div>
        </div>
      )}

      {transactionsForMonth.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <Receipt size={26} className="text-zinc-600" />
          </div>
          <p className="text-sm font-semibold text-zinc-400 mb-1">No transactions for this month</p>
          <p className="text-xs text-zinc-600">Upload statements and tag them to a month to see invoices</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total Spend</p>
              <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{formatINR(totals.debit)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total Income</p>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{formatINR(totals.credit)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Net Flow</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${totals.net >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatINR(totals.net)}
              </p>
            </div>
          </div>

          {/* By Owner Section */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
              <User size={16} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-300">By Owner</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {Object.entries(byOwner).map(([ownerId, data]) => {
                const owner = owners.find(o => o.id === ownerId)
                const isExpanded = expandedOwners.has(ownerId)
                return (
                  <div key={ownerId}>
                    <button
                      onClick={() => toggleOwner(ownerId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                        <span className="font-medium text-zinc-200">{owner?.name || 'Unknown'}</span>
                        <span className="text-xs text-zinc-500">{data.transactions.length} transactions</span>
                      </div>
                      <span className="font-mono text-rose-400">{formatINR(data.total)}</span>
                    </button>
                    {isExpanded && (
                      <div className="bg-zinc-900/30 px-4 pb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-zinc-500">
                              <th className="text-left py-2">Date</th>
                              <th className="text-left py-2">Description</th>
                              <th className="text-left py-2">Category</th>
                              <th className="text-right py-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.transactions.map(txn => (
                              <tr key={txn.id} className="border-t border-zinc-800/50">
                                <td className="py-2 text-zinc-400">{new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                <td className="py-2 text-zinc-300">{txn.description}</td>
                                <td className="py-2 text-zinc-400">{txn.category?.name || '-'}</td>
                                <td className="py-2 text-right font-mono text-rose-400">{formatINR(txn.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Category Section */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
              <Tag size={16} className="text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-300">By Category</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {byCategory.map((cat) => {
                const isExpanded = expandedCategories.has(cat.name)
                return (
                  <div key={cat.name}>
                    <button
                      onClick={() => toggleCategory(cat.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                        <span className="font-medium text-zinc-200">{cat.name}</span>
                        <span className="text-xs text-zinc-500">{cat.count} transactions</span>
                      </div>
                      <span className="font-mono text-rose-400">{formatINR(cat.total)}</span>
                    </button>
                    {isExpanded && (
                      <div className="bg-zinc-900/30 px-4 pb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-zinc-500">
                              <th className="text-left py-2">Date</th>
                              <th className="text-left py-2">Description</th>
                              <th className="text-left py-2">Owner</th>
                              <th className="text-right py-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.transactions.map(txn => {
                              const ownerNames = txn.transactionOwners?.map((o: any) => o.owner.name).join(', ') || '-'
                              return (
                                <tr key={txn.id} className="border-t border-zinc-800/50">
                                  <td className="py-2 text-zinc-400">{new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                  <td className="py-2 text-zinc-300">{txn.description}</td>
                                  <td className="py-2 text-zinc-400">{ownerNames}</td>
                                  <td className="py-2 text-right font-mono text-rose-400">{formatINR(txn.amount)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

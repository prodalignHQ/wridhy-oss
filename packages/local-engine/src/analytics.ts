// ─── Local analytics — port of apps/api/src/services/insights.service.ts ────
// Operates on in-memory arrays so it runs identically in a Web Worker,
// OPFS/SQLCipher client, or future Android/iOS on-device runtime.
// Math conventions intentionally mirror the server (string decimals in,
// string decimals out, transfers excluded, credit-in-expense reduces spend).

import type {
  AccountingMode,
  CategoryAverage,
  CategoryComparison,
  MonthlyInsight,
  YearlyInsight,
} from '@momoney/types'
import type {
  LocalCategory,
  LocalInvoiceLink,
  LocalStatement,
  LocalTransaction,
  LocalTransactionOwner,
} from './types.js'

export interface LocalAnalyticsInput {
  transactions: LocalTransaction[]
  categories: LocalCategory[]
  statements: LocalStatement[]
  /** statementId -> invoice link (invoice mode grouping) */
  invoiceLinks?: LocalInvoiceLink[]
  owners?: LocalTransactionOwner[]
}

function monthOfDateStr(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM-DD -> YYYY-MM
}

function statementMonthMap(statements: LocalStatement[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of statements) m.set(s.id, s.statementMonth.slice(0, 7))
  return m
}

function invoiceMonthMap(links: LocalInvoiceLink[] = []): Map<string, string> {
  const m = new Map<string, string>()
  for (const l of links) m.set(l.statementId, l.invoiceMonth.slice(0, 7))
  return m
}

function effectiveMonth(
  txn: LocalTransaction,
  mode: AccountingMode,
  stmtMonths: Map<string, string>,
  invMonths: Map<string, string>
): string {
  if (mode === 'transaction') return monthOfDateStr(txn.date)
  if (txn.statementId) {
    const inv = invMonths.get(txn.statementId)
    if (inv) return inv
    const stmt = stmtMonths.get(txn.statementId)
    if (stmt) return stmt
  }
  return monthOfDateStr(txn.date)
}

function categoryById(categories: LocalCategory[]): Map<string, LocalCategory> {
  return new Map(categories.map((c) => [c.id, c]))
}

function ownerAmountMap(owners: LocalTransactionOwner[] = []): Map<string, LocalTransactionOwner[]> {
  const m = new Map<string, LocalTransactionOwner[]>()
  for (const o of owners) {
    const arr = m.get(o.transactionId) ?? []
    arr.push(o)
    m.set(o.transactionId, arr)
  }
  return m
}

function inOwnerFilter(
  txnId: string,
  ownerIds: string[] | undefined,
  ownerMap: Map<string, LocalTransactionOwner[]>
): boolean {
  if (!ownerIds || ownerIds.length === 0) return true
  const rows = ownerMap.get(txnId) ?? []
  return rows.some((r) => ownerIds.includes(r.ownerId))
}

/** Amount attributed to the owner filter: sum of owner shares, else full amount. */
function attributedAmount(
  txn: LocalTransaction,
  ownerIds: string[] | undefined,
  ownerMap: Map<string, LocalTransactionOwner[]>
): number {
  if (!ownerIds || ownerIds.length === 0) return parseFloat(txn.amount)
  const rows = (ownerMap.get(txn.id) ?? []).filter((r) => ownerIds.includes(r.ownerId))
  return rows.reduce((acc, r) => acc + parseFloat(r.amount), 0)
}

export function getMonthlyInsightsLocal(
  input: LocalAnalyticsInput,
  month: string,
  ownerIds?: string[],
  mode: AccountingMode = 'invoice'
): MonthlyInsight {
  const catMap = categoryById(input.categories)
  const stmtMonths = statementMonthMap(input.statements)
  const invMonths = invoiceMonthMap(input.invoiceLinks)
  const ownerMap = ownerAmountMap(input.owners)

  let totalSpendNum = 0
  let totalInvestmentsNum = 0
  let totalIncomeNum = 0
  let uncategorizedCount = 0
  const perCategory = new Map<string, { id: string; name: string; color: string; net: number }>()

  for (const txn of input.transactions) {
    if (effectiveMonth(txn, mode, stmtMonths, invMonths) !== month) continue
    if (!inOwnerFilter(txn.id, ownerIds, ownerMap)) continue
    const amt = attributedAmount(txn, ownerIds, ownerMap)
    const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined
    const categoryType = cat?.type ?? 'expense'

    if (!txn.categoryId) uncategorizedCount++

    if (txn.type === 'debit') {
      if (categoryType === 'investment') totalInvestmentsNum += amt
      else if (categoryType !== 'transfer') totalSpendNum += amt
    } else {
      if (categoryType === 'investment') totalInvestmentsNum -= amt
      else if (categoryType === 'expense') totalSpendNum -= amt
      else if (categoryType !== 'transfer') totalIncomeNum += amt
    }

    // Top categories: expense only, net debits-credits
    if (txn.categoryId && cat && (cat.type === 'expense' || !cat.type)) {
      const net = txn.type === 'debit' ? amt : -amt
      const existing = perCategory.get(cat.id) ?? { id: cat.id, name: cat.name, color: cat.color ?? '', net: 0 }
      existing.net += net
      perCategory.set(cat.id, existing)
    }
  }

  if (totalSpendNum < 0) totalSpendNum = 0

  const topCategories = Array.from(perCategory.values())
    .filter((c) => c.net > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      amount: c.net.toFixed(2),
      percentage: totalSpendNum > 0 ? (c.net / totalSpendNum) * 100 : 0,
    }))

  return {
    totalSpend: totalSpendNum.toFixed(2),
    totalInvestments: totalInvestmentsNum.toFixed(2),
    totalIncome: totalIncomeNum.toFixed(2),
    netFlow: (totalIncomeNum - totalSpendNum - totalInvestmentsNum).toFixed(2),
    topCategories,
    uncategorizedCount,
    mode,
  }
}

export function getYearlyInsightsLocal(
  input: LocalAnalyticsInput,
  year: number,
  ownerIds?: string[],
  mode: AccountingMode = 'invoice'
): YearlyInsight {
  const catMap = categoryById(input.categories)
  const stmtMonths = statementMonthMap(input.statements)
  const invMonths = invoiceMonthMap(input.invoiceLinks)
  const ownerMap = ownerAmountMap(input.owners)

  const months: Record<string, { spend: number; income: number }> = {}
  for (let i = 0; i < 12; i++) {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`
    months[m] = { spend: 0, income: 0 }
  }

  for (const txn of input.transactions) {
    const em = effectiveMonth(txn, mode, stmtMonths, invMonths)
    if (!em.startsWith(`${year}-`)) continue
    if (!months[em]) continue
    if (!inOwnerFilter(txn.id, ownerIds, ownerMap)) continue
    const amt = attributedAmount(txn, ownerIds, ownerMap)
    const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined
    const categoryType = cat?.type ?? 'expense'
    const bucket = months[em]!

    if (txn.type === 'debit' && categoryType === 'expense') {
      bucket.spend += amt
    } else if (txn.type === 'credit') {
      if (categoryType === 'expense') bucket.spend = Math.max(0, bucket.spend - amt)
      else if (categoryType !== 'transfer') bucket.income += amt
    }
  }

  return Object.entries(months).map(([month, data]) => ({
    month,
    spend: data.spend.toFixed(2),
    income: data.income.toFixed(2),
  }))
}

function categoryInsightsLocal(
  input: LocalAnalyticsInput,
  targetMonth: string,
  ownerIds: string[] | undefined,
  mode: AccountingMode
): Array<{ id: string; name: string; color: string; amount: string; percentage: number }> {
  const catMap = categoryById(input.categories)
  const stmtMonths = statementMonthMap(input.statements)
  const invMonths = invoiceMonthMap(input.invoiceLinks)
  const ownerMap = ownerAmountMap(input.owners)
  const perCategory = new Map<string, { id: string; name: string; color: string; net: number }>()

  for (const txn of input.transactions) {
    if (effectiveMonth(txn, mode, stmtMonths, invMonths) !== targetMonth) continue
    if (!inOwnerFilter(txn.id, ownerIds, ownerMap)) continue
    const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined
    if (!txn.categoryId || !cat) continue
    if (cat.type !== 'expense') continue
    const amt = attributedAmount(txn, ownerIds, ownerMap)
    const net = txn.type === 'debit' ? amt : -amt
    const existing = perCategory.get(cat.id) ?? { id: cat.id, name: cat.name, color: cat.color ?? '', net: 0 }
    existing.net += net
    perCategory.set(cat.id, existing)
  }

  const rows = Array.from(perCategory.values()).filter((c) => c.net > 0)
  const totalSpend = rows.reduce((acc, r) => acc + r.net, 0)
  return rows
    .sort((a, b) => b.net - a.net)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      amount: r.net.toFixed(2),
      percentage: totalSpend > 0 ? (r.net / totalSpend) * 100 : 0,
    }))
}

export function getCategoryComparisonLocal(
  input: LocalAnalyticsInput,
  month: string,
  ownerIds?: string[],
  mode: AccountingMode = 'invoice'
): CategoryComparison {
  const parts = month.split('-').map(Number)
  const yearNum = parts[0] ?? new Date().getFullYear()
  const monthNum = parts[1] ?? new Date().getMonth() + 1
  const prevDate = new Date(yearNum, monthNum - 2, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const current = categoryInsightsLocal(input, month, ownerIds, mode)
  const prev = categoryInsightsLocal(input, prevMonth, ownerIds, mode)
  const map: Record<string, { id: string; name: string; color: string; currentAmount: string; prevAmount: string }> = {}

  for (const r of current) map[r.id] = { id: r.id, name: r.name, color: r.color, currentAmount: r.amount, prevAmount: '0' }
  for (const r of prev) {
    const existing = map[r.id]
    if (existing) existing.prevAmount = r.amount
    else map[r.id] = { id: r.id, name: r.name, color: r.color, currentAmount: '0', prevAmount: r.amount }
  }

  return Object.values(map)
    .map((c) => {
      const cur = parseFloat(c.currentAmount)
      const prv = parseFloat(c.prevAmount)
      const diff = cur - prv
      return {
        ...c,
        diff: diff.toFixed(2),
        diffPercentage: prv > 0 ? (diff / prv) * 100 : cur > 0 ? 100 : 0,
      }
    })
    .sort((a, b) => parseFloat(b.currentAmount) - parseFloat(a.currentAmount))
}

export function getCategoryAveragesLocal(
  input: LocalAnalyticsInput,
  currentMonth: string,
  ownerIds?: string[],
  mode: AccountingMode = 'invoice'
): CategoryAverage {
  const parts = currentMonth.split('-').map(Number)
  const yearNum = parts[0] ?? new Date().getFullYear()
  const monthNum = parts[1] ?? new Date().getMonth() + 1
  const startDate = new Date(yearNum, monthNum - 13, 1)
  const startMonthStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`

  const catMap = categoryById(input.categories)
  const stmtMonths = statementMonthMap(input.statements)
  const invMonths = invoiceMonthMap(input.invoiceLinks)
  const ownerMap = ownerAmountMap(input.owners)
  const totals = new Map<string, { id: string; name: string; color: string; total: number }>()

  for (const txn of input.transactions) {
    const em = effectiveMonth(txn, mode, stmtMonths, invMonths)
    if (em < startMonthStr || em > currentMonth) continue
    if (!inOwnerFilter(txn.id, ownerIds, ownerMap)) continue
    const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined
    if (!txn.categoryId || !cat || cat.type !== 'expense') continue
    const amt = attributedAmount(txn, ownerIds, ownerMap)
    const net = txn.type === 'debit' ? amt : -amt
    const existing = totals.get(cat.id) ?? { id: cat.id, name: cat.name, color: cat.color ?? '', total: 0 }
    existing.total += net
    totals.set(cat.id, existing)
  }

  const currentData = categoryInsightsLocal(input, currentMonth, ownerIds, mode)
  return Array.from(totals.values())
    .filter((r) => r.total > 0)
    .map((row) => {
      const current = currentData.find((c) => c.id === row.id)
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        avgAmount: (row.total / 12).toFixed(2),
        currentAmount: current ? current.amount : '0',
      }
    })
    .sort((a, b) => parseFloat(b.avgAmount) - parseFloat(a.avgAmount))
}

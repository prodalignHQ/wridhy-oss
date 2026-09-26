// ─── Local invoice analysis — port of buildAnalysis ─────────────────────────
// apps/api/src/routes/invoices.ts buildAnalysis, adapted to local types.
// Pure function: identical totals given identical inputs (verified by fixture
// test in invoice-check, see Phase 3 notes). Transfer categories excluded,
// credits negate owner shares, investments tracked separately from spending.

import type { LocalOwnerShare } from './types.js'

export interface LocalInvoiceTxn {
  id: string
  type: 'debit' | 'credit'
  isOneTime: boolean
  categoryName: string
  categoryId: string | null
  categoryColor: string | null
  categoryType: string
  owners: LocalOwnerShare[]
}

export interface OwnerCategoryTotal {
  categoryId: string | null
  category: string
  color: string | null
  type: string
  total: number
  regularTotal: number
  oneTimeTotal: number
}

export interface OwnerBreakdown {
  ownerId: string | null
  name: string
  color: string | null
  total: number
  spendingTotal: number
  regularSpendingTotal: number
  oneTimeSpendingTotal: number
  investmentTotal: number
  regularInvestmentTotal: number
  oneTimeInvestmentTotal: number
  categories: OwnerCategoryTotal[]
}

export interface InvoiceAnalysis {
  totalSpend: number
  regularSpend: number
  oneTimeSpend: number
  totalInvestments: number
  regularInvestments: number
  oneTimeInvestments: number
  totalOutflow: number
  ownerTotals: Array<{
    ownerId: string | null
    name: string
    color: string | null
    total: number
    spendingTotal: number
    regularSpendingTotal: number
    oneTimeSpendingTotal: number
    investmentTotal: number
    regularInvestmentTotal: number
    oneTimeInvestmentTotal: number
  }>
  ownerCategoryTotals: OwnerBreakdown[]
  categoryTotals: OwnerCategoryTotal[]
}

export function buildInvoiceAnalysisLocal(transactionsList: LocalInvoiceTxn[]): InvoiceAnalysis {
  const ownerTotals = new Map<
    string,
    {
      ownerId: string | null
      name: string
      color: string | null
      total: number
      spendingTotal: number
      regularSpendingTotal: number
      oneTimeSpendingTotal: number
      investmentTotal: number
      regularInvestmentTotal: number
      oneTimeInvestmentTotal: number
      categories: Map<string, OwnerCategoryTotal>
    }
  >()

  const categoryTotalsMap = new Map<string, OwnerCategoryTotal>()

  for (const transaction of transactionsList) {
    const isCredit = transaction.type === 'credit'
    if (transaction.type !== 'debit' && !isCredit) continue

    const categoryName = transaction.categoryName ?? 'Uncategorized'
    const categoryId = transaction.categoryId ?? null
    const categoryColor = transaction.categoryColor ?? null
    const categoryType = transaction.categoryType ?? 'expense'

    // Internal transfers are balance movements, not spending/investments.
    if (categoryType === 'transfer') continue

    const isInvestment = categoryType === 'investment'
    const isOneTime = Boolean(transaction.isOneTime)

    for (const owner of transaction.owners) {
      const ownerKey = owner.ownerId ?? owner.name
      const amount = parseFloat(owner.amount)
      const adjustedAmount = isCredit ? -amount : amount

      if (!ownerTotals.has(ownerKey)) {
        ownerTotals.set(ownerKey, {
          ownerId: owner.ownerId,
          name: owner.name,
          color: owner.color,
          total: 0,
          spendingTotal: 0,
          regularSpendingTotal: 0,
          oneTimeSpendingTotal: 0,
          investmentTotal: 0,
          regularInvestmentTotal: 0,
          oneTimeInvestmentTotal: 0,
          categories: new Map(),
        })
      }

      const ownerBucket = ownerTotals.get(ownerKey)!
      ownerBucket.total += adjustedAmount

      if (isInvestment) {
        ownerBucket.investmentTotal += adjustedAmount
        if (isOneTime) {
          ownerBucket.oneTimeInvestmentTotal += adjustedAmount
        } else {
          ownerBucket.regularInvestmentTotal += adjustedAmount
        }
      } else {
        ownerBucket.spendingTotal += adjustedAmount
        if (isOneTime) {
          ownerBucket.oneTimeSpendingTotal += adjustedAmount
        } else {
          ownerBucket.regularSpendingTotal += adjustedAmount
        }
      }

      const categoryKey = `${categoryId ?? 'uncategorized'}:${categoryName}`
      if (!ownerBucket.categories.has(categoryKey)) {
        ownerBucket.categories.set(categoryKey, {
          categoryId,
          category: categoryName,
          color: categoryColor,
          type: categoryType,
          total: 0,
          regularTotal: 0,
          oneTimeTotal: 0,
        })
      }

      const ownerCat = ownerBucket.categories.get(categoryKey)!
      ownerCat.total += adjustedAmount
      if (isOneTime) {
        ownerCat.oneTimeTotal += adjustedAmount
      } else {
        ownerCat.regularTotal += adjustedAmount
      }

      if (!categoryTotalsMap.has(categoryKey)) {
        categoryTotalsMap.set(categoryKey, {
          categoryId,
          category: categoryName,
          color: categoryColor,
          type: categoryType,
          total: 0,
          regularTotal: 0,
          oneTimeTotal: 0,
        })
      }
      const overallCat = categoryTotalsMap.get(categoryKey)!
      overallCat.total += adjustedAmount
      if (isOneTime) {
        overallCat.oneTimeTotal += adjustedAmount
      } else {
        overallCat.regularTotal += adjustedAmount
      }
    }
  }

  const ownerBreakdown = Array.from(ownerTotals.values())
    .map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
      spendingTotal: owner.spendingTotal,
      regularSpendingTotal: owner.regularSpendingTotal,
      oneTimeSpendingTotal: owner.oneTimeSpendingTotal,
      investmentTotal: owner.investmentTotal,
      regularInvestmentTotal: owner.regularInvestmentTotal,
      oneTimeInvestmentTotal: owner.oneTimeInvestmentTotal,
      categories: Array.from(owner.categories.values()).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total)

  const categoryTotals = Array.from(categoryTotalsMap.values()).sort((a, b) => b.total - a.total)

  const totalSpend = ownerBreakdown.reduce((acc, o) => acc + o.spendingTotal, 0)
  const regularSpend = ownerBreakdown.reduce((acc, o) => acc + o.regularSpendingTotal, 0)
  const oneTimeSpend = ownerBreakdown.reduce((acc, o) => acc + o.oneTimeSpendingTotal, 0)
  const totalInvestments = ownerBreakdown.reduce((acc, o) => acc + o.investmentTotal, 0)
  const regularInvestments = ownerBreakdown.reduce((acc, o) => acc + o.regularInvestmentTotal, 0)
  const oneTimeInvestments = ownerBreakdown.reduce((acc, o) => acc + o.oneTimeInvestmentTotal, 0)
  const totalOutflow = ownerBreakdown.reduce((acc, o) => acc + o.total, 0)

  return {
    totalSpend,
    regularSpend,
    oneTimeSpend,
    totalInvestments,
    regularInvestments,
    oneTimeInvestments,
    totalOutflow,
    ownerTotals: ownerBreakdown.map((owner) => ({
      ownerId: owner.ownerId,
      name: owner.name,
      color: owner.color,
      total: owner.total,
      spendingTotal: owner.spendingTotal,
      regularSpendingTotal: owner.regularSpendingTotal,
      oneTimeSpendingTotal: owner.oneTimeSpendingTotal,
      investmentTotal: owner.investmentTotal,
      regularInvestmentTotal: owner.regularInvestmentTotal,
      oneTimeInvestmentTotal: owner.oneTimeInvestmentTotal,
    })),
    ownerCategoryTotals: ownerBreakdown,
    categoryTotals,
  }
}

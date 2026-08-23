import { db } from '@momoney/db'
import {
  transactions,
  transactionOwners,
  categories,
  statements,
} from '@momoney/db'
import { eq, and, or, inArray, gte, lte, sql, desc, isNull } from 'drizzle-orm'
import { MonthlyInsight, YearlyInsight, CategoryComparison, CategoryAverage } from '@momoney/types'

/**
 * The insights date for a transaction:
 *  - If the transaction has a linked statement, use statementMonth (user-tagged billing month).
 *  - Otherwise fall back to the raw transaction date.
 *
 * This lets credit-card purchases in April show up as May outflows
 * when the statement for April is tagged to May.
 *
 * Both branches resolve to PG `date`.  All comparisons use plain YYYY-MM-DD
 * strings — Drizzle serialises JS Date objects with timezone info that PG
 * `date` columns cannot parse.
 */
const insightsDate = sql<Date>`CASE
  WHEN ${statements.id} IS NOT NULL THEN ${statements.statementMonth}
  ELSE ${transactions.date}::date
END`

/** Convert a Date to a plain 'YYYY-MM-DD' string (avoids Drizzle timezone serialisation). */
const toISODate = (d: Date) => d.toISOString().slice(0, 10)

export class InsightsService {
  // ─── Monthly ──────────────────────────────────────────────────────────────────

  async getMonthlyInsights(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[]
  ): Promise<MonthlyInsight> {
    const startDate = `${month}-01`
    const endDate = toISODate(new Date(new Date(`${startDate}`).setMonth(new Date(`${startDate}`).getMonth() + 1)))

    const conditions = [
      eq(transactions.userId, userId),
      gte(insightsDate, startDate),
      lte(insightsDate, endDate),
    ]

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    // ── Totals (grouped by credit/debit and category type) ──

    const resultQuery = db
      .select({
        type: transactions.type,
        categoryType: sql<string>`coalesce(${categories.type}, 'expense')`,
        total: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
        )
      )
      .groupBy(transactions.type, sql`coalesce(${categories.type}, 'expense')`)

    let totalSpendNum = 0
    let totalInvestmentsNum = 0
    let totalIncomeNum = 0

    for (const r of result) {
      const amt = parseFloat(r.total || '0')
      if (r.type === 'debit') {
        if (r.categoryType === 'investment') {
          totalInvestmentsNum += amt
        } else if (r.categoryType !== 'transfer') {
          totalSpendNum += amt
        }
      } else if (r.type === 'credit') {
        totalIncomeNum += amt
      }
    }

    const totalSpend = totalSpendNum.toFixed(2)
    const totalInvestments = totalInvestmentsNum.toFixed(2)
    const totalIncome = totalIncomeNum.toFixed(2)
    const netFlow = (totalIncomeNum - totalSpendNum - totalInvestmentsNum).toFixed(2)

    // ── Top categories ──

    const topCategoriesQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      topCategoriesQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const topCategoriesRows = await topCategoriesQuery
      .where(
        and(
          ...conditions,
          eq(transactions.type, 'debit'),
          or(eq(categories.type, 'expense'), isNull(categories.type)),
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .orderBy(desc(sql`sum(${amountExpr})`))
      .limit(5)

    const topCategories = topCategoriesRows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      amount: r.amount,
      percentage: totalSpendNum > 0 ? (parseFloat(r.amount) / totalSpendNum) * 100 : 0,
    }))

    // ── Uncategorized count ──

    const uncategorizedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .where(and(...conditions, isNull(transactions.categoryId)))

    return {
      totalSpend,
      totalInvestments,
      totalIncome,
      netFlow,
      topCategories,
      uncategorizedCount: uncategorizedResult[0]?.count || 0,
    }
  }

  // ─── Yearly ───────────────────────────────────────────────────────────────────

  async getYearlyInsights(
    userId: string,
    year: number,
    ownerIds?: string[]
  ): Promise<YearlyInsight> {
    const startDate = `${year}-01-01`
    const endDate = toISODate(new Date(new Date(`${year + 1}-01-01`).getTime() - 1))

    const conditions = [
      eq(transactions.userId, userId),
      gte(insightsDate, startDate),
      lte(insightsDate, endDate),
    ]

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    const resultQuery = db
      .select({
        month: sql<string>`to_char(${insightsDate}, 'YYYY-MM')`,
        type: transactions.type,
        categoryType: sql<string>`coalesce(${categories.type}, 'expense')`,
        amount: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
        )
      )
      .groupBy(sql`to_char(${insightsDate}, 'YYYY-MM')`, transactions.type, sql`coalesce(${categories.type}, 'expense')`)

    const months: Record<string, { spend: string; income: string }> = {}
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      months[m] = { spend: '0', income: '0' }
    }

    for (const r of result) {
      const monthData = months[r.month]
      if (monthData) {
        const amt = parseFloat(r.amount || '0')
        if (r.type === 'debit' && r.categoryType === 'expense') {
          monthData.spend = (parseFloat(monthData.spend) + amt).toFixed(2)
        } else if (r.type === 'credit') {
          monthData.income = (parseFloat(monthData.income) + amt).toFixed(2)
        }
      }
    }

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
    }))
  }

  // ─── Category helpers ─────────────────────────────────────────────────────────

  /**
   * Spend per category for a date range.
   * Called internally by getCategoryComparison and getCategoryAverages.
   */
  private async getCategoryInsights(
    userId: string,
    startDateISO: string, // YYYY-MM-DD
    endDateISO: string,   // YYYY-MM-DD
    ownerIds?: string[]
  ): Promise<Array<{ id: string; name: string; color: string; amount: string; percentage: number }>> {
    const conditions = [
      eq(transactions.userId, userId),
      gte(insightsDate, startDateISO),
      lte(insightsDate, endDateISO),
      eq(transactions.type, 'debit'),
    ]

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    // Total spend across expense categories (includes uncategorized — used for %)
    const totalSpendQuery = db
      .select({ total: sql<string>`sum(${amountExpr})` })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      totalSpendQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const totalSpendResult = await totalSpendQuery.where(
      and(
        ...conditions,
        or(eq(categories.type, 'expense'), isNull(categories.type)),
        hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
      )
    )

    const totalSpend = parseFloat(totalSpendResult[0]?.total || '0')

    // Per-category totals (only expense categories)
    const rowsQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      rowsQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const rows = await rowsQuery
      .where(
        and(
          ...conditions,
          or(eq(categories.type, 'expense'), isNull(categories.type)),
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .orderBy(desc(sql`sum(${amountExpr})`))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      amount: r.amount,
      percentage: totalSpend > 0 ? (parseFloat(r.amount) / totalSpend) * 100 : 0,
    }))
  }

  // ─── Category comparison ──────────────────────────────────────────────────────

  async getCategoryComparison(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[]
  ): Promise<CategoryComparison> {
    const currentMonthStart = `${month}-01`
    const currentMonthEnd = toISODate(new Date(new Date(`${currentMonthStart}`).setMonth(new Date(`${currentMonthStart}`).getMonth() + 1)))

    const prevMonthObj = new Date(`${currentMonthStart}`)
    prevMonthObj.setMonth(prevMonthObj.getMonth() - 1)
    const prevMonthStart = toISODate(prevMonthObj)
    const prevMonthEnd = currentMonthStart

    const [currentResults, prevResults] = await Promise.all([
      this.getCategoryInsights(userId, currentMonthStart, currentMonthEnd, ownerIds),
      this.getCategoryInsights(userId, prevMonthStart, prevMonthEnd, ownerIds),
    ])

    const categoriesMap: Record<string, { id: string; name: string; color: string; currentAmount: string; prevAmount: string }> = {}

    currentResults.forEach((r) => {
      categoriesMap[r.id] = { id: r.id, name: r.name, color: r.color || '', currentAmount: r.amount, prevAmount: '0' }
    })

    prevResults.forEach((r) => {
      const existing = categoriesMap[r.id]
      if (existing) {
        existing.prevAmount = r.amount
      } else {
        categoriesMap[r.id] = { id: r.id, name: r.name, color: r.color || '', currentAmount: '0', prevAmount: r.amount }
      }
    })

    return Object.values(categoriesMap)
      .map((c) => {
        const current = parseFloat(c.currentAmount)
        const prev = parseFloat(c.prevAmount)
        const diff = current - prev
        const diffPercentage = prev > 0 ? (diff / prev) * 100 : current > 0 ? 100 : 0

        return {
          ...c,
          diff: diff.toFixed(2),
          diffPercentage,
        }
      })
      .sort((a, b) => parseFloat(b.currentAmount) - parseFloat(a.currentAmount))
  }

  // ─── Category averages ────────────────────────────────────────────────────────

  async getCategoryAverages(
    userId: string,
    currentMonth: string, // YYYY-MM
    ownerIds?: string[]
  ): Promise<CategoryAverage> {
    const twelveMonthsAgo = new Date(`${currentMonth}-01`)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const twelveMonthsAgoISO = toISODate(twelveMonthsAgo)

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    // 12-month average spend per category (only expense categories)
    const avgQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        totalAmount: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'debit'),
          or(eq(categories.type, 'expense'), isNull(categories.type)),
          gte(insightsDate, twelveMonthsAgoISO),
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined,
        )
      )

    if (hasOwnerFilter) {
      avgQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const avgRows = await avgQuery.groupBy(categories.id, categories.name, categories.color)

    // Current month spend per category
    const currentMonthStart = `${currentMonth}-01`
    const currentMonthEnd = toISODate(new Date(new Date(`${currentMonthStart}`).setMonth(new Date(`${currentMonthStart}`).getMonth() + 1)))
    const currentData = await this.getCategoryInsights(userId, currentMonthStart, currentMonthEnd, ownerIds)

    return avgRows
      .map((row) => {
        const current = currentData.find((c) => c.id === row.id)
        const avg = parseFloat(row.totalAmount) / 12

        return {
          id: row.id,
          name: row.name,
          color: row.color,
          avgAmount: avg.toFixed(2),
          currentAmount: current ? current.amount : '0',
        }
      })
      .sort((a, b) => parseFloat(b.avgAmount) - parseFloat(a.avgAmount))
  }
}

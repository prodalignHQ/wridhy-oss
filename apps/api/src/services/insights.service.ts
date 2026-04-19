import { db } from '@momoney/db'
import {
  transactions,
  transactionOwners,
  categories,
  financialAccounts,
} from '@momoney/db'
import { eq, and, inArray, gte, lte, sql, desc, or, isNull } from 'drizzle-orm'
import { MonthlyInsight, YearlyInsight, CategoryComparison, CategoryAverage } from '@momoney/types'

export class InsightsService {
  /**
   * Get monthly insights (total spend, income, net flow, top categories, top merchants)
   */
  async getMonthlyInsights(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[]
  ): Promise<MonthlyInsight> {
    const startDate = new Date(`${month}-01`)
    const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1))

    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, new Date(endDate.getTime() - 1)),
    ]

    // Base query for totals
    const resultQuery = db
      .select({
        type: transactions.type,
        total: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`,
      })
      .from(transactions)

    if (ownerIds && ownerIds.length > 0) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(transactions.type)

    const totalSpend = result.find((r) => r.type === 'debit')?.total || '0'
    const totalIncome = result.find((r) => r.type === 'credit')?.total || '0'
    const netFlow = (parseFloat(totalIncome) - parseFloat(totalSpend)).toFixed(2)

    // Top Categories
    const topCategoriesQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (ownerIds && ownerIds.length > 0) {
      topCategoriesQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const topCategoriesRows = await topCategoriesQuery
      .where(
        and(
          ...conditions,
          eq(transactions.type, 'debit'),
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .orderBy(desc(sql`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`))
      .limit(5)

    const totalSpendNum = parseFloat(totalSpend)
    const topCategories = topCategoriesRows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      amount: r.amount,
      percentage: totalSpendNum > 0 ? (parseFloat(r.amount) / totalSpendNum) * 100 : 0,
    }))

    // Uncategorized Count
    const uncategorizedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(and(...conditions, isNull(transactions.categoryId)))

    return {
      totalSpend,
      totalIncome,
      netFlow,
      topCategories,
      uncategorizedCount: uncategorizedResult[0]?.count || 0,
    }
  }

  /**
   * Get yearly insights (12 months of spend/income)
   */
  async getYearlyInsights(
    userId: string,
    year: number,
    ownerIds?: string[]
  ): Promise<YearlyInsight> {
    const startDate = new Date(`${year}-01-01`)
    const endDate = new Date(`${year + 1}-01-01`)

    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, new Date(endDate.getTime() - 1)),
    ]

    const resultQuery = db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        type: transactions.type,
        amount: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`,
      })
      .from(transactions)

    if (ownerIds && ownerIds.length > 0) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, transactions.type)

    // Format into 12 months array
    const months: Record<string, { spend: string; income: string }> = {}
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      months[m] = { spend: '0', income: '0' }
    }

    for (const r of result) {
      const monthData = months[r.month]
      if (monthData) {
        if (r.type === 'debit') monthData.spend = r.amount
        else monthData.income = r.amount
      }
    }

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
    }))
  }

  /**
   * Get category insights (spend per category for a date range)
   */
  async getCategoryInsights(
    userId: string,
    startDate: string,
    endDate: string,
    ownerIds?: string[]
  ): Promise<any[]> {
    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.date, new Date(startDate)),
      lte(transactions.date, new Date(endDate)),
      eq(transactions.type, 'debit'),
    ]

    const totalSpendQuery = db
      .select({ total: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})` })
      .from(transactions)

    if (ownerIds && ownerIds.length > 0) {
      totalSpendQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const totalSpendResult = await totalSpendQuery
      .where(
        and(
          ...conditions,
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )

    const totalSpend = parseFloat(totalSpendResult[0]?.total || '0')

    const rowsQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (ownerIds && ownerIds.length > 0) {
      rowsQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const rows = await rowsQuery
      .where(
        and(
          ...conditions,
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .orderBy(desc(sql`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`))

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      amount: r.amount,
      percentage: totalSpend > 0 ? (parseFloat(r.amount) / totalSpend) * 100 : 0,
    }))
  }



  /**
   * Get category comparison (current vs last month)
   */
  async getCategoryComparison(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[]
  ): Promise<any[]> {
    const currentMonthStart = new Date(`${month}-01`)
    const currentMonthEnd = new Date(new Date(currentMonthStart).setMonth(currentMonthStart.getMonth() + 1))
    
    const prevMonthStart = new Date(currentMonthStart)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
    const prevMonthEnd = currentMonthStart

    const [currentResults, prevResults] = await Promise.all([
      this.getCategoryInsights(userId, currentMonthStart.toISOString().split('T')[0]!, currentMonthEnd.toISOString().split('T')[0]!, ownerIds),
      this.getCategoryInsights(userId, prevMonthStart.toISOString().split('T')[0]!, prevMonthEnd.toISOString().split('T')[0]!, ownerIds)
    ])

    const categoriesMap: Record<string, { id: string; name: string; color: string; currentAmount: string; prevAmount: string }> = {}

    currentResults.forEach(r => {
      categoriesMap[r.id] = { id: r.id, name: r.name, color: r.color || '', currentAmount: r.amount, prevAmount: '0' }
    })

    prevResults.forEach(r => {
      const existing = categoriesMap[r.id]
      if (existing) {
        existing.prevAmount = r.amount
      } else {
        categoriesMap[r.id] = { id: r.id, name: r.name, color: r.color || '', currentAmount: '0', prevAmount: r.amount }
      }
    })

    return Object.values(categoriesMap).map(c => {
      const current = parseFloat(c.currentAmount)
      const prev = parseFloat(c.prevAmount)
      const diff = current - prev
      const diffPercentage = prev > 0 ? (diff / prev) * 100 : current > 0 ? 100 : 0
      
      return {
        ...c,
        diff: diff.toFixed(2),
        diffPercentage
      }
    }).sort((a, b) => parseFloat(b.currentAmount) - parseFloat(a.currentAmount))
  }

  /**
   * Get 12-month category averages
   */
  async getCategoryAverages(
    userId: string,
    currentMonth: string, // YYYY-MM (to compare current vs avg)
    ownerIds?: string[]
  ): Promise<any[]> {
    const twelveMonthsAgo = new Date(`${currentMonth}-01`)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    // Average spend per category over last 12 months
    const avgQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        totalAmount: sql<string>`sum(${ownerIds && ownerIds.length > 0 ? transactionOwners.amount : transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'debit'),
          gte(transactions.date, twelveMonthsAgo),
          ownerIds && ownerIds.length > 0 ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
    
    if (ownerIds && ownerIds.length > 0) {
      avgQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const avgRows = await avgQuery
      .groupBy(categories.id, categories.name, categories.color)

    // Current month spend per category
    const currentMonthStart = new Date(`${currentMonth}-01`)
    const currentData = await this.getCategoryInsights(
      userId, 
      currentMonthStart.toISOString().split('T')[0]!, 
      new Date(new Date(currentMonthStart).setMonth(currentMonthStart.getMonth() + 1)).toISOString().split('T')[0]!, 
      ownerIds
    )

    return avgRows.map(row => {
      const current = currentData.find(c => c.id === row.id)
      const avg = parseFloat(row.totalAmount) / 12
      
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        avgAmount: avg.toFixed(2),
        currentAmount: current ? current.amount : '0'
      }
    }).sort((a, b) => parseFloat(b.avgAmount) - parseFloat(a.avgAmount))
  }
}

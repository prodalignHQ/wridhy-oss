import { db, isSqlite } from '@momoney/db'
import {
  transactions,
  transactionOwners,
  categories,
  statements,
  invoiceStatements,
  invoices,
} from '@momoney/db'
import { eq, and, or, inArray, sql, desc, isNull } from 'drizzle-orm'
import {
  MonthlyInsight,
  YearlyInsight,
  CategoryComparison,
  CategoryAverage,
  AccountingMode,
} from '@momoney/types'

const txnDateMonthSql = isSqlite
  ? sql<string>`strftime('%Y-%m', ${transactions.date}, 'unixepoch')`
  : sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`

const invoiceMonthSql = isSqlite
  ? sql<string>`strftime('%Y-%m', ${invoices.invoiceMonth})`
  : sql<string>`to_char(${invoices.invoiceMonth}, 'YYYY-MM')`

const statementMonthSql = isSqlite
  ? sql<string>`strftime('%Y-%m', ${statements.statementMonth})`
  : sql<string>`to_char(${statements.statementMonth}, 'YYYY-MM')`

/**
 * Resolves the effective grouping month (YYYY-MM) for a transaction.
 * In 'invoice' mode:
 *   1. Invoice month if statement is attached to an invoice
 *   2. Statement month if transaction belongs to a statement
 *   3. Calendar date of transaction if unattached
 * In 'transaction' mode:
 *   Calendar date of transaction (YYYY-MM)
 */
function getEffectiveMonthExpr(mode: AccountingMode) {
  if (mode === 'transaction') {
    return txnDateMonthSql
  }
  return sql<string>`
    COALESCE(
      ${invoiceMonthSql},
      ${statementMonthSql},
      ${txnDateMonthSql}
    )
  `
}

export class InsightsService {
  // ─── Monthly ──────────────────────────────────────────────────────────────────

  async getMonthlyInsights(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[],
    mode: AccountingMode = 'invoice'
  ): Promise<MonthlyInsight> {
    const effectiveMonth = getEffectiveMonthExpr(mode)

    const conditions = [
      eq(transactions.userId, userId),
      sql`${effectiveMonth} = ${month}`,
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
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(transactions.type, sql`coalesce(${categories.type}, 'expense')`)

    let totalSpendNum = 0
    let totalInvestmentsNum = 0
    let totalIncomeNum = 0

    for (const r of result) {
      const amt = Math.abs(parseFloat(r.total || '0'))
      if (r.type === 'debit') {
        if (r.categoryType === 'investment') {
          totalInvestmentsNum += amt
        } else if (r.categoryType !== 'transfer') {
          totalSpendNum += amt
        }
      } else if (r.type === 'credit') {
        if (r.categoryType === 'investment') {
          totalInvestmentsNum -= amt
        } else if (r.categoryType === 'expense') {
          // Refunds or returns in expense categories reduce total spend
          totalSpendNum -= amt
        } else if (r.categoryType !== 'transfer') {
          totalIncomeNum += amt
        }
      }
    }

    if (totalSpendNum < 0) totalSpendNum = 0

    const totalSpend = totalSpendNum.toFixed(2)
    const totalInvestments = totalInvestmentsNum.toFixed(2)
    const totalIncome = totalIncomeNum.toFixed(2)
    const netFlow = (totalIncomeNum - totalSpendNum - totalInvestmentsNum).toFixed(2)

    // ── Top categories (Net spending: debits minus credits/refunds) ──
    const netCatAmountSql = sql<string>`sum(case when ${transactions.type} = 'debit' then ${amountExpr} else -${amountExpr} end)`

    const topCategoriesQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: netCatAmountSql,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      topCategoriesQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const topCategoriesRows = await topCategoriesQuery
      .where(
        and(
          ...conditions,
          or(eq(categories.type, 'expense'), isNull(categories.type)),
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .having(sql`${netCatAmountSql} > 0`)
      .orderBy(desc(netCatAmountSql))
      .limit(5)

    const topCategories = topCategoriesRows.map((r) => {
      const amtNum = parseFloat(r.amount)
      return {
        id: r.id,
        name: r.name,
        color: r.color,
        amount: amtNum.toFixed(2),
        percentage: totalSpendNum > 0 ? (amtNum / totalSpendNum) * 100 : 0,
      }
    })

    // ── Uncategorized count ──
    const uncategorizedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .where(and(...conditions, isNull(transactions.categoryId)))

    // ── Reconciliation metadata ──
    const matchedInvoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.userId, userId),
        sql`${invoiceMonthSql} = ${month}`
      ),
      with: {
        statements: true,
      },
    })

    const stmtsForMonth = await db.query.statements.findMany({
      where: and(
        eq(statements.userId, userId),
        sql`${statementMonthSql} = ${month}`
      ),
      with: {
        account: true,
      },
    })

    const statementNames = matchedInvoice?.statements?.length
      ? matchedInvoice.statements.map((s) => s.accountName)
      : stmtsForMonth.map((s) => s.account?.accountName || s.bankId)

    const reconciliation = {
      invoiceId: matchedInvoice?.id,
      invoiceName: matchedInvoice?.name,
      invoiceStatus: matchedInvoice?.status,
      statementCount: matchedInvoice?.statements?.length ?? stmtsForMonth.length,
      statementNames,
    }

    return {
      totalSpend,
      totalInvestments,
      totalIncome,
      netFlow,
      topCategories,
      uncategorizedCount: uncategorizedResult[0]?.count || 0,
      mode,
      reconciliation,
    }
  }

  // ─── Yearly ───────────────────────────────────────────────────────────────────

  async getYearlyInsights(
    userId: string,
    year: number,
    ownerIds?: string[],
    mode: AccountingMode = 'invoice'
  ): Promise<YearlyInsight> {
    const effectiveMonth = getEffectiveMonthExpr(mode)
    const yearPrefix = `${year}-%`

    const conditions = [
      eq(transactions.userId, userId),
      sql`${effectiveMonth} LIKE ${yearPrefix}`,
    ]

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    const resultQuery = db
      .select({
        month: effectiveMonth,
        type: transactions.type,
        categoryType: sql<string>`coalesce(${categories.type}, 'expense')`,
        amount: sql<string>`sum(${amountExpr})`,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      resultQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const result = await resultQuery
      .where(
        and(
          ...conditions,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(effectiveMonth, transactions.type, sql`coalesce(${categories.type}, 'expense')`)

    const months: Record<string, { spend: string; income: string }> = {}
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      months[m] = { spend: '0', income: '0' }
    }

    for (const r of result) {
      const monthData = months[r.month]
      if (monthData) {
        const amt = Math.abs(parseFloat(r.amount || '0'))
        if (r.type === 'debit' && r.categoryType === 'expense') {
          monthData.spend = (parseFloat(monthData.spend) + amt).toFixed(2)
        } else if (r.type === 'credit') {
          if (r.categoryType === 'expense') {
            monthData.spend = Math.max(0, parseFloat(monthData.spend) - amt).toFixed(2)
          } else if (r.categoryType !== 'transfer') {
            monthData.income = (parseFloat(monthData.income) + amt).toFixed(2)
          }
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
   * Spend per category for a specific month (YYYY-MM).
   * Called internally by getCategoryComparison and getCategoryAverages.
   */
  private async getCategoryInsights(
    userId: string,
    targetMonth: string, // YYYY-MM
    ownerIds?: string[],
    mode: AccountingMode = 'invoice'
  ): Promise<Array<{ id: string; name: string; color: string; amount: string; percentage: number }>> {
    const effectiveMonth = getEffectiveMonthExpr(mode)

    const conditions = [
      eq(transactions.userId, userId),
      sql`${effectiveMonth} = ${targetMonth}`,
      or(eq(categories.type, 'expense'), isNull(categories.type)),
    ]

    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    const netCatAmountSql = sql<string>`sum(case when ${transactions.type} = 'debit' then ${amountExpr} else -${amountExpr} end)`

    // Per-category totals (only expense categories with net > 0)
    const rowsQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        amount: netCatAmountSql,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))

    if (hasOwnerFilter) {
      rowsQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const rows = await rowsQuery
      .where(
        and(
          ...conditions,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )
      .groupBy(categories.id, categories.name, categories.color)
      .having(sql`${netCatAmountSql} > 0`)
      .orderBy(desc(netCatAmountSql))

    const totalSpend = rows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount)), 0)

    return rows.map((r) => {
      const amtNum = Math.abs(parseFloat(r.amount))
      return {
        id: r.id,
        name: r.name,
        color: r.color,
        amount: amtNum.toFixed(2),
        percentage: totalSpend > 0 ? (amtNum / totalSpend) * 100 : 0,
      }
    })
  }

  // ─── Category comparison ──────────────────────────────────────────────────────

  async getCategoryComparison(
    userId: string,
    month: string, // YYYY-MM
    ownerIds?: string[],
    mode: AccountingMode = 'invoice'
  ): Promise<CategoryComparison> {
    const parts = month.split('-').map(Number)
    const yearNum = parts[0] ?? new Date().getFullYear()
    const monthNum = parts[1] ?? (new Date().getMonth() + 1)
    const prevDate = new Date(yearNum, monthNum - 2, 1)
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

    const [currentResults, prevResults] = await Promise.all([
      this.getCategoryInsights(userId, month, ownerIds, mode),
      this.getCategoryInsights(userId, prevMonth, ownerIds, mode),
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
    ownerIds?: string[],
    mode: AccountingMode = 'invoice'
  ): Promise<CategoryAverage> {
    const parts = currentMonth.split('-').map(Number)
    const yearNum = parts[0] ?? new Date().getFullYear()
    const monthNum = parts[1] ?? (new Date().getMonth() + 1)
    const startYearMo = new Date(yearNum, monthNum - 13, 1)
    const startMonthStr = `${startYearMo.getFullYear()}-${String(startYearMo.getMonth() + 1).padStart(2, '0')}`

    const effectiveMonth = getEffectiveMonthExpr(mode)
    const hasOwnerFilter = ownerIds && ownerIds.length > 0
    const amountExpr = hasOwnerFilter ? transactionOwners.amount : transactions.amount

    const netCatAmountSql = sql<string>`sum(case when ${transactions.type} = 'debit' then ${amountExpr} else -${amountExpr} end)`

    // 12-month spend per category
    const avgQuery = db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        totalAmount: netCatAmountSql,
      })
      .from(transactions)
      .leftJoin(statements, eq(transactions.statementId, statements.id))
      .leftJoin(invoiceStatements, eq(invoiceStatements.statementId, transactions.statementId))
      .leftJoin(invoices, eq(invoices.id, invoiceStatements.invoiceId))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          or(eq(categories.type, 'expense'), isNull(categories.type)),
          sql`${effectiveMonth} >= ${startMonthStr}`,
          sql`${effectiveMonth} <= ${currentMonth}`,
          hasOwnerFilter ? inArray(transactionOwners.ownerId, ownerIds) : undefined
        )
      )

    if (hasOwnerFilter) {
      avgQuery.leftJoin(transactionOwners, eq(transactionOwners.transactionId, transactions.id))
    }

    const avgRows = await avgQuery
      .groupBy(categories.id, categories.name, categories.color)
      .having(sql`${netCatAmountSql} > 0`)

    // Current month spend per category
    const currentData = await this.getCategoryInsights(userId, currentMonth, ownerIds, mode)

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

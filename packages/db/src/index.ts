import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as pgSchema from './schema.js'
import * as sqliteSchema from './schema.sqlite.js'
import { initSqliteDatabase } from './sqlite-init.js'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

export const isSqlite = (() => {
  if (process.env['DB_DIALECT'] === 'sqlite' || process.env['MOMONEY_LOCAL_MODE'] === 'true') {
    return true
  }
  if (process.env['DB_DIALECT'] === 'postgres' || process.env['DB_DIALECT'] === 'postgresql') {
    return false
  }
  const dbUrl = process.env['DATABASE_URL']
  if (!dbUrl) {
    return true // Default to SQLite if no DATABASE_URL is provided
  }
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    return false
  }
  return true // file:, sqlite://, local .db file, etc.
})()

function getSqliteDb() {
  let dbPath = process.env['SQLITE_DB_PATH']
  if (!dbPath) {
    const dbUrl = process.env['DATABASE_URL']
    if (dbUrl && dbUrl.startsWith('file:')) {
      dbPath = dbUrl.slice(5)
    } else if (dbUrl && (dbUrl.endsWith('.db') || dbUrl.endsWith('.sqlite'))) {
      dbPath = dbUrl
    } else {
      const dataDir = path.join(os.homedir(), '.momoney')
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      dbPath = path.join(dataDir, 'momoney.db')
    }
  }

  if (dbPath.startsWith('~')) {
    dbPath = path.join(os.homedir(), dbPath.slice(1))
  }

  const resolvedDir = path.dirname(path.resolve(dbPath))
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true })
  }

  const isBun = typeof (globalThis as any).Bun !== 'undefined'
  if (isBun) {
    const { drizzle } = require('drizzle-orm/bun-sqlite')
    const { Database } = require('bun:sqlite')
    const sqlite = new Database(dbPath)
    initSqliteDatabase(sqlite)
    return drizzle(sqlite, { schema: sqliteSchema })
  } else {
    const { drizzle } = require('drizzle-orm/better-sqlite3')
    const Database = require('better-sqlite3')
    const sqlite = new Database(dbPath)
    initSqliteDatabase(sqlite)
    return drizzle(sqlite, { schema: sqliteSchema })
  }
}

function getPgDb() {
  const dbUrl = process.env['DATABASE_URL']
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL mode')
  }
  const sql = postgres(dbUrl)
  return drizzlePg(sql, { schema: pgSchema })
}

export const db = (isSqlite ? getSqliteDb() : getPgDb()) as unknown as ReturnType<typeof drizzlePg<typeof pgSchema>>

// Active schema exports (typed as pgSchema for seamless TS checks, mapped to SQLite at runtime)
export const users = (isSqlite ? sqliteSchema.users : pgSchema.users) as typeof pgSchema.users
export const accounts = (isSqlite ? sqliteSchema.accounts : pgSchema.accounts) as typeof pgSchema.accounts
export const sessions = (isSqlite ? sqliteSchema.sessions : pgSchema.sessions) as typeof pgSchema.sessions
export const verifications = (isSqlite ? sqliteSchema.verifications : pgSchema.verifications) as typeof pgSchema.verifications
export const owners = (isSqlite ? sqliteSchema.owners : pgSchema.owners) as typeof pgSchema.owners
export const financialAccounts = (isSqlite ? sqliteSchema.financialAccounts : pgSchema.financialAccounts) as typeof pgSchema.financialAccounts
export const categories = (isSqlite ? sqliteSchema.categories : pgSchema.categories) as typeof pgSchema.categories
export const merchants = (isSqlite ? sqliteSchema.merchants : pgSchema.merchants) as typeof pgSchema.merchants
export const categorizationRules = (isSqlite ? sqliteSchema.categorizationRules : pgSchema.categorizationRules) as typeof pgSchema.categorizationRules
export const statements = (isSqlite ? sqliteSchema.statements : pgSchema.statements) as typeof pgSchema.statements
export const transactions = (isSqlite ? sqliteSchema.transactions : pgSchema.transactions) as typeof pgSchema.transactions
export const transactionOwners = (isSqlite ? sqliteSchema.transactionOwners : pgSchema.transactionOwners) as typeof pgSchema.transactionOwners
export const invoices = (isSqlite ? sqliteSchema.invoices : pgSchema.invoices) as typeof pgSchema.invoices
export const invoiceStatements = (isSqlite ? sqliteSchema.invoiceStatements : pgSchema.invoiceStatements) as typeof pgSchema.invoiceStatements
export const invoiceItems = (isSqlite ? sqliteSchema.invoiceItems : pgSchema.invoiceItems) as typeof pgSchema.invoiceItems
export const assets = (isSqlite ? sqliteSchema.assets : pgSchema.assets) as typeof pgSchema.assets
export const liabilities = (isSqlite ? sqliteSchema.liabilities : pgSchema.liabilities) as typeof pgSchema.liabilities
export const netWorthSnapshots = (isSqlite ? sqliteSchema.netWorthSnapshots : pgSchema.netWorthSnapshots) as typeof pgSchema.netWorthSnapshots
export const netWorthDrafts = (isSqlite ? sqliteSchema.netWorthDrafts : pgSchema.netWorthDrafts) as typeof pgSchema.netWorthDrafts
export const financialYearIncomes = (isSqlite ? sqliteSchema.financialYearIncomes : pgSchema.financialYearIncomes) as typeof pgSchema.financialYearIncomes
export const salarySources = (isSqlite ? sqliteSchema.salarySources : pgSchema.salarySources) as typeof pgSchema.salarySources
export const salaryRevisions = (isSqlite ? sqliteSchema.salaryRevisions : pgSchema.salaryRevisions) as typeof pgSchema.salaryRevisions

export * from './schema.js'


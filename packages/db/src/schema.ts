import { pgTable, text, timestamp, uuid, integer, numeric, boolean, jsonb, pgEnum, date } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum('account_type', ['bank', 'credit_card', 'wallet', 'investment'])
export const transactionTypeEnum = pgEnum('transaction_type', ['debit', 'credit'])
export const ruleSourceEnum = pgEnum('rule_source', ['system', 'user'])
export const matchFieldEnum = pgEnum('match_field', ['merchant', 'description', 'amount'])
export const matchTypeEnum = pgEnum('match_type', ['contains', 'equals', 'regex', 'gt', 'lt'])
export const assetTypeEnum = pgEnum('asset_type', [
  'mutual_fund',
  'stock',
  'fixed_deposit',
  'recurring_deposit',
  'ppf',
  'savings_account',
  'real_estate',
  'crypto',
  'cash',
  'other'
])
export const liabilityTypeEnum = pgEnum('liability_type', ['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other'])
export const equityDebtTagEnum = pgEnum('equity_debt_tag', ['equity', 'debt', 'mixed', 'cash'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'generated'])

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verifications = pgTable('verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Owners ──────────────────────────────────────────────────────────────────

export const owners = pgTable('owners', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  color: text('color').notNull().default('indigo'), // from fixed palette
  isDefault: boolean('is_default').notNull().default(false), // true for "Self"
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Financial Accounts ───────────────────────────────────────────────────────

export const financialAccounts = pgTable('financial_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountName: text('account_name').notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  bankId: text('bank_id').notNull(), // e.g. "icici_savings", "icici_credit"
  bankName: text('bank_name').notNull(),
  currency: text('currency').notNull().default('INR'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Categories ───────────────────────────────────────────────────────────────
// userId NULL = system-level category

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // NULL = system
  name: text('name').notNull(),
  icon: text('icon'), // emoji or icon name
  color: text('color').notNull().default('#6366f1'),
  parentId: uuid('parent_id'), // self-referencing for subcategories
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Merchants ────────────────────────────────────────────────────────────────
// userId NULL = system merchant record

export const merchants = pgTable('merchants', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // NULL = system
  rawPatterns: jsonb('raw_patterns').notNull().$type<string[]>(), // e.g. ["AMZN", "Amazon Pay"]
  normalizedName: text('normalized_name').notNull(),
  defaultCategoryId: uuid('default_category_id').references(() => categories.id),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Categorization Rules ─────────────────────────────────────────────────────
// userId NULL = system rule

export const categorizationRules = pgTable('categorization_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // NULL = system
  matchField: matchFieldEnum('match_field').notNull(),
  matchType: matchTypeEnum('match_type').notNull(),
  matchValue: text('match_value').notNull(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  priority: integer('priority').notNull().default(500), // 1–999 user, 1000–4999 system
  source: ruleSourceEnum('source').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Statements ───────────────────────────────────────────────────────────────

export const statements = pgTable('statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  bankId: text('bank_id').notNull(), // e.g. "hdfc", "icici"
  statementMonth: date('statement_month').notNull(), // YYYY-MM-01
  parsedCount: integer('parsed_count').notNull().default(0),
  importedCount: integer('imported_count').notNull().default(0),
  duplicatesSkipped: integer('duplicates_skipped').notNull().default(0),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
})

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  statementId: uuid('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  date: timestamp('date', { mode: 'date' }).notNull(),
  description: text('description').notNull(),
  merchant: text('merchant'), // normalized merchant name
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  comment: text('comment'), // user comment field
  dedupHash: text('dedup_hash').notNull().unique(), // hash(accountId+date+amount+descriptionHash)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Transaction Owners ───────────────────────────────────────────────────────

export const transactionOwners = pgTable('transaction_owners', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => owners.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(), // owner's share amount
  percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(), // always equal split = 100/n
})

// ─── Invoices ────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  invoiceMonth: date('invoice_month').notNull(), // YYYY-MM-01
  status: invoiceStatusEnum('status').notNull().default('draft'),
  generatedAt: timestamp('generated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const invoiceStatements = pgTable('invoice_statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  statementId: uuid('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
  statementMonth: date('statement_month').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  statementId: uuid('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  date: timestamp('date', { mode: 'date' }).notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  categoryName: text('category_name').notNull().default('Uncategorized'),
  categoryColor: text('category_color'),
  owners: jsonb('owners')
    .notNull()
    .$type<Array<{ ownerId: string | null; name: string; color: string | null; amount: string; percentage: string }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: assetTypeEnum('type').notNull(),
  value: numeric('value', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('INR'),
  equityDebtTag: equityDebtTagEnum('equity_debt_tag'),
  metadata: jsonb('metadata').notNull().default({}),
  valuationDate: timestamp('valuation_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Liabilities ──────────────────────────────────────────────────────────────

export const liabilities = pgTable('liabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: liabilityTypeEnum('type').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }), // optional %
  monthlyPayment: numeric('monthly_payment', { precision: 15, scale: 2 }), // optional
  lastUpdated: timestamp('last_updated', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Net Worth Snapshots ──────────────────────────────────────────────────────

export const netWorthSnapshots = pgTable('net_worth_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  snapshotDate: timestamp('snapshot_date', { mode: 'date' }).notNull(), // first day of month
  totalAssets: numeric('total_assets', { precision: 15, scale: 2 }).notNull(),
  totalLiabilities: numeric('total_liabilities', { precision: 15, scale: 2 }).notNull(),
  netWorth: numeric('net_worth', { precision: 15, scale: 2 }).notNull(),
  assetBreakdown: jsonb('asset_breakdown').$type<Array<{ name: string; type: string; value: number; equityDebtTag?: string }>>(),
  liabilityBreakdown: jsonb('liability_breakdown').$type<Array<{ name: string; type: string; amount: number }>>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Net Worth Drafts ─────────────────────────────────────────────────────────
// One row per user — stores in-progress (unsaved snapshot) working state

export const netWorthDrafts = pgTable('net_worth_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'cascade' }).unique(),
  assetBreakdown: jsonb('asset_breakdown').$type<Array<Record<string, any>>>(),
  liabilityBreakdown: jsonb('liability_breakdown').$type<Array<Record<string, any>>>(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  owners: many(owners),
  accounts: many(accounts),
  sessions: many(sessions),
  financialAccounts: many(financialAccounts),
  statements: many(statements),
  transactions: many(transactions),
  invoices: many(invoices),
  categories: many(categories),
  categorizationRules: many(categorizationRules),
  merchants: many(merchants),
  assets: many(assets),
  liabilities: many(liabilities),
  netWorthSnapshots: many(netWorthSnapshots),
  netWorthDraft: one(netWorthDrafts, { fields: [users.id], references: [netWorthDrafts.userId] }),
}))

export const ownersRelations = relations(owners, ({ one, many }) => ({
  user: one(users, { fields: [owners.userId], references: [users.id] }),
  transactionOwners: many(transactionOwners),
  assets: many(assets),
  liabilities: many(liabilities),
  netWorthSnapshots: many(netWorthSnapshots),
  netWorthDrafts: many(netWorthDrafts),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const financialAccountsRelations = relations(financialAccounts, ({ one, many }) => ({
  user: one(users, { fields: [financialAccounts.userId], references: [users.id] }),
  statements: many(statements),
  transactions: many(transactions),
  invoiceStatements: many(invoiceStatements),
}))

export const statementsRelations = relations(statements, ({ one, many }) => ({
  user: one(users, { fields: [statements.userId], references: [users.id] }),
  account: one(financialAccounts, { fields: [statements.accountId], references: [financialAccounts.id] }),
  transactions: many(transactions),
  invoiceStatements: many(invoiceStatements),
  invoiceItems: many(invoiceItems),
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
  statement: one(statements, { fields: [transactions.statementId], references: [statements.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  transactionOwners: many(transactionOwners),
  invoiceItems: many(invoiceItems),
}))

export const transactionOwnersRelations = relations(transactionOwners, ({ one }) => ({
  transaction: one(transactions, { fields: [transactionOwners.transactionId], references: [transactions.id] }),
  owner: one(owners, { fields: [transactionOwners.ownerId], references: [owners.id] }),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  rules: many(categorizationRules),
  invoiceItems: many(invoiceItems),
}))

export const categorizationRulesRelations = relations(categorizationRules, ({ one }) => ({
  user: one(users, { fields: [categorizationRules.userId], references: [users.id] }),
  category: one(categories, { fields: [categorizationRules.categoryId], references: [categories.id] }),
}))

export const merchantsRelations = relations(merchants, ({ one }) => ({
  user: one(users, { fields: [merchants.userId], references: [users.id] }),
  defaultCategory: one(categories, { fields: [merchants.defaultCategoryId], references: [categories.id] }),
}))

export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(users, { fields: [assets.userId], references: [users.id] }),
  owner: one(owners, { fields: [assets.ownerId], references: [owners.id] }),
}))

export const liabilitiesRelations = relations(liabilities, ({ one }) => ({
  user: one(users, { fields: [liabilities.userId], references: [users.id] }),
  owner: one(owners, { fields: [liabilities.ownerId], references: [owners.id] }),
}))

export const netWorthSnapshotsRelations = relations(netWorthSnapshots, ({ one }) => ({
  user: one(users, { fields: [netWorthSnapshots.userId], references: [users.id] }),
  owner: one(owners, { fields: [netWorthSnapshots.ownerId], references: [owners.id] }),
}))

export const netWorthDraftsRelations = relations(netWorthDrafts, ({ one }) => ({
  user: one(users, { fields: [netWorthDrafts.userId], references: [users.id] }),
  owner: one(owners, { fields: [netWorthDrafts.ownerId], references: [owners.id] }),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  statements: many(invoiceStatements),
  items: many(invoiceItems),
}))

export const invoiceStatementsRelations = relations(invoiceStatements, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceStatements.invoiceId], references: [invoices.id] }),
  statement: one(statements, { fields: [invoiceStatements.statementId], references: [statements.id] }),
  account: one(financialAccounts, { fields: [invoiceStatements.accountId], references: [financialAccounts.id] }),
}))

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  transaction: one(transactions, { fields: [invoiceItems.transactionId], references: [transactions.id] }),
  statement: one(statements, { fields: [invoiceItems.statementId], references: [statements.id] }),
  category: one(categories, { fields: [invoiceItems.categoryId], references: [categories.id] }),
}))

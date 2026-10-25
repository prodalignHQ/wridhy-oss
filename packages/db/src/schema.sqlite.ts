import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ─── Enums (Typed string constants for SQLite) ────────────────────────────────

export const accountTypeValues = ['bank', 'credit_card', 'wallet', 'investment'] as const
export const transactionTypeValues = ['debit', 'credit'] as const
export const ruleSourceValues = ['system', 'user'] as const
export const matchFieldValues = ['merchant', 'description', 'amount'] as const
export const matchTypeValues = ['contains', 'equals', 'regex', 'gt', 'lt'] as const
export const assetTypeValues = [
  'mutual_fund',
  'stock',
  'fixed_deposit',
  'recurring_deposit',
  'ppf',
  'savings_account',
  'real_estate',
  'crypto',
  'cash',
  'other',
] as const
export const liabilityTypeValues = ['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other'] as const
export const equityDebtTagValues = ['equity', 'debt', 'mixed', 'cash'] as const
export const categoryTypeValues = ['expense', 'investment', 'income', 'transfer'] as const
export const invoiceStatusValues = ['draft', 'generated'] as const

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Owners ──────────────────────────────────────────────────────────────────

export const owners = sqliteTable('owners', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  color: text('color').notNull().default('indigo'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Financial Accounts ───────────────────────────────────────────────────────

export const financialAccounts = sqliteTable('financial_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountName: text('account_name').notNull(),
  accountType: text('account_type', { enum: accountTypeValues }).notNull(),
  bankId: text('bank_id').notNull(),
  bankName: text('bank_name').notNull(),
  currency: text('currency').notNull().default('INR'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: categoryTypeValues }).notNull().default('expense'),
  icon: text('icon'),
  color: text('color').notNull().default('#6366f1'),
  parentId: text('parent_id'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Merchants ────────────────────────────────────────────────────────────────

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  rawPatterns: text('raw_patterns', { mode: 'json' }).notNull().$type<string[]>(),
  normalizedName: text('normalized_name').notNull(),
  defaultCategoryId: text('default_category_id').references(() => categories.id),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Categorization Rules ─────────────────────────────────────────────────────

export const categorizationRules = sqliteTable('categorization_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  matchField: text('match_field', { enum: matchFieldValues }).notNull(),
  matchType: text('match_type', { enum: matchTypeValues }).notNull(),
  matchValue: text('match_value').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  priority: integer('priority').notNull().default(500),
  source: text('source', { enum: ruleSourceValues }).notNull().default('user'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Statements ───────────────────────────────────────────────────────────────

export const statements = sqliteTable('statements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  bankId: text('bank_id').notNull(),
  statementMonth: text('statement_month').notNull(), // YYYY-MM-01
  parsedCount: integer('parsed_count').notNull().default(0),
  importedCount: integer('imported_count').notNull().default(0),
  duplicatesSkipped: integer('duplicates_skipped').notNull().default(0),
  importedAt: integer('imported_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  description: text('description').notNull(),
  merchant: text('merchant'),
  amount: text('amount').notNull(),
  type: text('type', { enum: transactionTypeValues }).notNull(),
  isOneTime: integer('is_one_time', { mode: 'boolean' }).notNull().default(false),
  categoryId: text('category_id').references(() => categories.id),
  comment: text('comment'),
  dedupHash: text('dedup_hash').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Transaction Owners ───────────────────────────────────────────────────────

export const transactionOwners = sqliteTable('transaction_owners', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => owners.id, { onDelete: 'cascade' }),
  amount: text('amount').notNull(),
  percentage: text('percentage').notNull(),
})

// ─── Invoices ────────────────────────────────────────────────────────────────

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  invoiceMonth: text('invoice_month').notNull(), // YYYY-MM-01
  status: text('status', { enum: invoiceStatusValues }).notNull().default('draft'),
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const invoiceStatements = sqliteTable('invoice_statements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  accountId: text('account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
  statementMonth: text('statement_month').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  description: text('description').notNull(),
  amount: text('amount').notNull(),
  type: text('type', { enum: transactionTypeValues }).notNull(),
  isOneTime: integer('is_one_time', { mode: 'boolean' }).notNull().default(false),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  categoryName: text('category_name').notNull().default('Uncategorized'),
  categoryColor: text('category_color'),
  categoryType: text('category_type').notNull().default('expense'),
  owners: text('owners', { mode: 'json' })
    .notNull()
    .$type<Array<{ ownerId: string | null; name: string; color: string | null; amount: string; percentage: string }>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: assetTypeValues }).notNull(),
  value: text('value').notNull(),
  currency: text('currency').notNull().default('INR'),
  equityDebtTag: text('equity_debt_tag', { enum: equityDebtTagValues }),
  metadata: text('metadata', { mode: 'json' }).notNull().default({}),
  valuationDate: integer('valuation_date', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Liabilities ──────────────────────────────────────────────────────────────

export const liabilities = sqliteTable('liabilities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: liabilityTypeValues }).notNull(),
  outstandingAmount: text('outstanding_amount').notNull(),
  interestRate: text('interest_rate'),
  monthlyPayment: text('monthly_payment'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Net Worth Snapshots ──────────────────────────────────────────────────────

export const netWorthSnapshots = sqliteTable('net_worth_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  snapshotDate: integer('snapshot_date', { mode: 'timestamp' }).notNull(),
  totalAssets: text('total_assets').notNull(),
  totalLiabilities: text('total_liabilities').notNull(),
  netWorth: text('net_worth').notNull(),
  assetBreakdown: text('asset_breakdown', { mode: 'json' }).$type<Array<{ name: string; type: string; value: number; equityDebtTag?: string }>>(),
  liabilityBreakdown: text('liability_breakdown', { mode: 'json' }).$type<Array<{ name: string; type: string; amount: number }>>(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Net Worth Drafts ─────────────────────────────────────────────────────────

export const netWorthDrafts = sqliteTable('net_worth_drafts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }).unique(),
  assetBreakdown: text('asset_breakdown', { mode: 'json' }).$type<Array<Record<string, any>>>(),
  liabilityBreakdown: text('liability_breakdown', { mode: 'json' }).$type<Array<Record<string, any>>>(),
  savedAt: integer('saved_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Income Growth (Financial Year Income) ───────────────────────────────────

export const financialYearIncomes = sqliteTable('financial_year_incomes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  grossIncome: text('gross_income').notNull(),
  taxPaid: text('tax_paid').notNull().default('0'),
  netIncome: text('net_income').notNull(),
  breakdown: text('breakdown', { mode: 'json' })
    .$type<{
      salary?: number
      bonus?: number
      business?: number
      investments?: number
      rental?: number
      freelance?: number
      other?: number
    }>()
    .default({}),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Salary Sources ──────────────────────────────────────────────────────────

export const salarySources = sqliteTable('salary_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => owners.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  role: text('role').notNull(),
  employmentType: text('employment_type').notNull().default('full_time'),
  currency: text('currency').notNull().default('INR'),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// ─── Salary Revisions ────────────────────────────────────────────────────────

export const salaryRevisions = sqliteTable('salary_revisions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  salarySourceId: text('salary_source_id').notNull().references(() => salarySources.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  effectiveDate: integer('effective_date', { mode: 'timestamp' }).notNull(),
  annualCtc: text('annual_ctc').notNull(),
  baseSalary: text('base_salary'),
  monthlyInHand: text('monthly_in_hand'),
  variablePay: text('variable_pay').default('0'),
  stockGrant: text('stock_grant').default('0'),
  hikePercentage: text('hike_percentage'),
  hikeType: text('hike_type').notNull().default('annual_review'),
  designation: text('designation'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
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
  financialYearIncomes: many(financialYearIncomes),
  salarySources: many(salarySources),
  salaryRevisions: many(salaryRevisions),
}))

export const ownersRelations = relations(owners, ({ one, many }) => ({
  user: one(users, { fields: [owners.userId], references: [users.id] }),
  transactionOwners: many(transactionOwners),
  assets: many(assets),
  liabilities: many(liabilities),
  netWorthSnapshots: many(netWorthSnapshots),
  netWorthDrafts: many(netWorthDrafts),
  financialYearIncomes: many(financialYearIncomes),
  salarySources: many(salarySources),
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

export const financialYearIncomesRelations = relations(financialYearIncomes, ({ one }) => ({
  user: one(users, { fields: [financialYearIncomes.userId], references: [users.id] }),
  owner: one(owners, { fields: [financialYearIncomes.ownerId], references: [owners.id] }),
}))

export const salarySourcesRelations = relations(salarySources, ({ one, many }) => ({
  user: one(users, { fields: [salarySources.userId], references: [users.id] }),
  owner: one(owners, { fields: [salarySources.ownerId], references: [owners.id] }),
  revisions: many(salaryRevisions),
}))

export const salaryRevisionsRelations = relations(salaryRevisions, ({ one }) => ({
  salarySource: one(salarySources, { fields: [salaryRevisions.salarySourceId], references: [salarySources.id] }),
  user: one(users, { fields: [salaryRevisions.userId], references: [users.id] }),
}))


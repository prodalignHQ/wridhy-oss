import { pgTable, text, timestamp, uuid, integer, numeric, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ownerTypeEnum = pgEnum('owner_type', ['person', 'shared', 'household'])
export const accountTypeEnum = pgEnum('account_type', ['bank', 'credit_card', 'wallet', 'investment'])
export const transactionTypeEnum = pgEnum('transaction_type', ['debit', 'credit'])
export const ruleSourceEnum = pgEnum('rule_source', ['system', 'user'])
export const matchFieldEnum = pgEnum('match_field', ['merchant', 'description', 'amount'])
export const matchTypeEnum = pgEnum('match_type', ['contains', 'equals', 'regex', 'gt', 'lt'])
export const assetTypeEnum = pgEnum('asset_type', ['bank_account', 'investment', 'real_estate', 'crypto', 'cash', 'other'])
export const liabilityTypeEnum = pgEnum('liability_type', ['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other'])

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Owners ──────────────────────────────────────────────────────────────────

export const owners = pgTable('owners', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: ownerTypeEnum('type').notNull().default('person'),
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

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: assetTypeEnum('type').notNull(),
  value: numeric('value', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('INR'),
  valuationDate: timestamp('valuation_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Liabilities ──────────────────────────────────────────────────────────────

export const liabilities = pgTable('liabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  snapshotDate: timestamp('snapshot_date', { mode: 'date' }).notNull(), // first day of month
  totalAssets: numeric('total_assets', { precision: 15, scale: 2 }).notNull(),
  totalLiabilities: numeric('total_liabilities', { precision: 15, scale: 2 }).notNull(),
  netWorth: numeric('net_worth', { precision: 15, scale: 2 }).notNull(),
  assetBreakdown: jsonb('asset_breakdown').$type<Array<{ name: string; type: string; value: number }>>(),
  liabilityBreakdown: jsonb('liability_breakdown').$type<Array<{ name: string; type: string; amount: number }>>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  owners: many(owners),
  financialAccounts: many(financialAccounts),
  statements: many(statements),
  transactions: many(transactions),
  categories: many(categories),
  categorizationRules: many(categorizationRules),
  merchants: many(merchants),
  assets: many(assets),
  liabilities: many(liabilities),
  netWorthSnapshots: many(netWorthSnapshots),
}))

export const ownersRelations = relations(owners, ({ one, many }) => ({
  user: one(users, { fields: [owners.userId], references: [users.id] }),
  transactionOwners: many(transactionOwners),
}))

export const financialAccountsRelations = relations(financialAccounts, ({ one, many }) => ({
  user: one(users, { fields: [financialAccounts.userId], references: [users.id] }),
  statements: many(statements),
  transactions: many(transactions),
}))

export const statementsRelations = relations(statements, ({ one, many }) => ({
  user: one(users, { fields: [statements.userId], references: [users.id] }),
  account: one(financialAccounts, { fields: [statements.accountId], references: [financialAccounts.id] }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
  statement: one(statements, { fields: [transactions.statementId], references: [statements.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  transactionOwners: many(transactionOwners),
}))

export const transactionOwnersRelations = relations(transactionOwners, ({ one }) => ({
  transaction: one(transactions, { fields: [transactionOwners.transactionId], references: [transactions.id] }),
  owner: one(owners, { fields: [transactionOwners.ownerId], references: [owners.id] }),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  rules: many(categorizationRules),
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
}))

export const liabilitiesRelations = relations(liabilities, ({ one }) => ({
  user: one(users, { fields: [liabilities.userId], references: [users.id] }),
}))

export const netWorthSnapshotsRelations = relations(netWorthSnapshots, ({ one }) => ({
  user: one(users, { fields: [netWorthSnapshots.userId], references: [users.id] }),
}))

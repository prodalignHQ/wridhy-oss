// ─── Local-first core types ─────────────────────────────────────────────────
// Mirrors the server Drizzle rows but as plain isomorphic structures so the
// same analytics can run on web (OPFS/SQLCipher), Android/iOS, or Node.

export interface LocalTransaction {
  id: string
  accountId: string
  statementId: string | null
  /** ISO date string (YYYY-MM-DD) — avoids Date serialization issues in Workers */
  date: string
  description: string
  merchant: string | null
  /** Decimal string, same convention as server numeric(15,2) */
  amount: string
  type: 'debit' | 'credit'
  isOneTime: boolean
  categoryId: string | null
  comment: string | null
  dedupHash: string
}

export interface LocalCategory {
  id: string
  name: string
  color: string | null
  type: 'expense' | 'investment' | 'income' | 'transfer'
}

export interface LocalStatement {
  id: string
  accountId: string
  bankId: string
  /** YYYY-MM-01 */
  statementMonth: string
  parsedCount: number
  importedCount: number
  duplicatesSkipped: number
}

export interface LocalTransactionOwner {
  transactionId: string
  ownerId: string
  amount: string
  percentage: string
}

export interface LocalFinancialAccount {
  id: string
  accountName: string
  accountType: string
  bankId: string
  bankName: string
  currency: string
}

export interface LocalOwner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

export interface LocalRule {
  id: string
  userId: string | null
  matchField: 'merchant' | 'description' | 'amount'
  matchType: 'contains' | 'equals' | 'regex' | 'gt' | 'lt'
  matchValue: string
  categoryId: string
  priority: number
  source: 'system' | 'user'
  isActive: boolean
}

export interface LocalMerchant {
  id: string
  userId: string | null
  rawPatterns: string[]
  normalizedName: string
  defaultCategoryId: string | null
  isSystem: boolean
}

export interface LocalOwnerShare {
  ownerId: string | null
  name: string
  color: string | null
  amount: string
  percentage: string
}

export interface LocalInvoice {
  id: string
  name: string
  status: 'draft' | 'generated'
  /** YYYY-MM-01 */
  invoiceMonth: string
  generatedAt: string | null
}

export interface LocalInvoiceStatement {
  invoiceId: string
  statementId: string | null
  accountId: string | null
  statementMonth: string
  accountName: string
  accountType: string
}

export interface LocalInvoiceItem {
  id: string
  invoiceId: string
  transactionId: string | null
  statementId: string | null
  date: string
  description: string
  amount: string
  type: 'debit' | 'credit'
  isOneTime: boolean
  categoryId: string | null
  categoryName: string
  categoryColor: string | null
  categoryType: string
  owners: LocalOwnerShare[]
}

export interface LocalInvoiceLink {
  statementId: string
  /** invoiceId that claims this statement (invoice mode grouping) */
  invoiceId: string
  /** YYYY-MM-01 of the invoice */
  invoiceMonth: string
}

// ─── Vault snapshot (encrypted sync primitive) ──────────────────────────────
// Core arrays (transactions/categories/statements/owners-shares) are required.
// Reference tables are optional so vaults sealed by older clients still open.

export interface VaultSnapshot {
  transactions: LocalTransaction[]
  categories: LocalCategory[]
  statements: LocalStatement[]
  owners: LocalTransactionOwner[]
  financialAccounts?: LocalFinancialAccount[]
  ownerList?: LocalOwner[]
  rules?: LocalRule[]
  merchants?: LocalMerchant[]
  invoices?: LocalInvoice[]
  invoiceStatements?: LocalInvoiceStatement[]
  invoiceItems?: LocalInvoiceItem[]
  updatedAt: string
}

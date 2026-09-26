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

export interface LocalInvoiceLink {
  statementId: string
  /** invoiceId that claims this statement (invoice mode grouping) */
  invoiceId: string
  /** YYYY-MM-01 of the invoice */
  invoiceMonth: string
}

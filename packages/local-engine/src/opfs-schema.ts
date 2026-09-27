// ─── OPFS SQLite schema + statement builders ────────────────────────────────
// Single source of truth for the on-device relational cache, shared by the
// browser Worker (wa-sqlite) and Node verification tests (node:sqlite).
// Plain SQLite only: no OPFS/WASM specifics here.
//
// Bump OPFS_SCHEMA_VERSION on every schema change. The client handshakes it
// on boot and refuses to run against a stale worker (Turbopack dev serves
// worker chunks with aggressive caching — without the handshake, new tables
// silently vanish, exactly like the net-worth 0-count incident).

export const OPFS_SCHEMA_VERSION = 2
// v1: initial 12 tables + changelog.
// v2: + local_assets, local_liabilities, local_networth_snapshots,
//     local_networth_drafts.

export const OPFS_SCHEMA = `
CREATE TABLE IF NOT EXISTS local_transactions(
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  statement_id TEXT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount TEXT NOT NULL,
  type TEXT NOT NULL,
  is_one_time INTEGER NOT NULL DEFAULT 0,
  category_id TEXT,
  comment TEXT,
  dedup_hash TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS local_statements(
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  statement_month TEXT NOT NULL,
  parsed_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS local_categories(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  type TEXT NOT NULL DEFAULT 'expense'
);
CREATE TABLE IF NOT EXISTS local_accounts(
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR'
);
CREATE TABLE IF NOT EXISTS local_owners(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  color TEXT NOT NULL DEFAULT 'indigo',
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS local_transaction_owners(
  transaction_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  percentage TEXT NOT NULL,
  PRIMARY KEY (transaction_id, owner_id)
);
CREATE TABLE IF NOT EXISTS local_rules(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  match_field TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 500,
  source TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS local_merchants(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  raw_patterns TEXT NOT NULL DEFAULT '[]',
  normalized_name TEXT NOT NULL,
  default_category_id TEXT,
  is_system INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS local_invoices(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_month TEXT NOT NULL,
  generated_at TEXT
);
CREATE TABLE IF NOT EXISTS local_invoice_statements(
  invoice_id TEXT NOT NULL,
  statement_id TEXT,
  account_id TEXT,
  statement_month TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_invoice_items(
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  transaction_id TEXT,
  statement_id TEXT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  type TEXT NOT NULL,
  is_one_time INTEGER NOT NULL DEFAULT 0,
  category_id TEXT,
  category_name TEXT NOT NULL DEFAULT 'Uncategorized',
  category_color TEXT,
  category_type TEXT NOT NULL DEFAULT 'expense',
  owners TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_local_txn_date ON local_transactions(date);
CREATE INDEX IF NOT EXISTS idx_local_txn_account ON local_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_local_txn_owners_txn ON local_transaction_owners(transaction_id);
CREATE INDEX IF NOT EXISTS idx_local_invoice_items_inv ON local_invoice_items(invoice_id);
CREATE TABLE IF NOT EXISTS local_assets(
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  equity_debt_tag TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  valuation_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_liabilities(
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  outstanding_amount TEXT NOT NULL,
  interest_rate TEXT,
  monthly_payment TEXT,
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_networth_snapshots(
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  snapshot_date TEXT NOT NULL,
  total_assets TEXT NOT NULL,
  total_liabilities TEXT NOT NULL,
  net_worth TEXT NOT NULL,
  asset_breakdown TEXT,
  liability_breakdown TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_networth_drafts(
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  asset_breakdown TEXT,
  liability_breakdown TEXT,
  saved_at TEXT NOT NULL
);
-- Operation log for incremental sync (Phase 5): every local mutation appends
-- here; the sync engine uploads only logged rows, then clears up to its mark.
CREATE TABLE IF NOT EXISTS local_changelog(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  op TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_local_changelog_id ON local_changelog(id);
`

export interface OpfsUpsertPatch {
  transactions?: Array<Record<string, unknown>>
  categories?: Array<Record<string, unknown>>
  statements?: Array<Record<string, unknown>>
  accounts?: Array<Record<string, unknown>>
  owners?: Array<Record<string, unknown>>
  transactionOwners?: Array<Record<string, unknown>>
  rules?: Array<Record<string, unknown>>
  merchants?: Array<Record<string, unknown>>
  invoices?: Array<Record<string, unknown>>
  invoiceStatements?: Array<Record<string, unknown>>
  invoiceItems?: Array<Record<string, unknown>>
  assets?: Array<Record<string, unknown>>
  liabilities?: Array<Record<string, unknown>>
  netWorthSnapshots?: Array<Record<string, unknown>>
  netWorthDrafts?: Array<Record<string, unknown>>
}

export interface OpfsBatch {
  queries: string[]
  params: unknown[][]
}

/** One transactional batch for the whole patch (worker runs it atomically). */
export function buildUpsertBatch(p: OpfsUpsertPatch): OpfsBatch {
  const queries: string[] = []
  const params: unknown[][] = []

  const txnSql = `INSERT INTO local_transactions(id,account_id,statement_id,date,description,merchant,amount,type,is_one_time,category_id,comment,dedup_hash)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,statement_id=excluded.statement_id,date=excluded.date,
      description=excluded.description,merchant=excluded.merchant,amount=excluded.amount,type=excluded.type,
      is_one_time=excluded.is_one_time,category_id=excluded.category_id,comment=excluded.comment,dedup_hash=excluded.dedup_hash`
  for (const t of p.transactions ?? []) {
    queries.push(txnSql)
    params.push([
      t['id'], t['accountId'], t['statementId'], t['date'], t['description'], t['merchant'],
      t['amount'], t['type'], t['isOneTime'] ? 1 : 0, t['categoryId'], t['comment'], t['dedupHash'],
    ])
  }
  const catSql = `INSERT INTO local_categories(id,name,color,type) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,type=excluded.type`
  for (const c of p.categories ?? []) {
    queries.push(catSql)
    params.push([c['id'], c['name'], c['color'], c['type']])
  }
  const stmtSql = `INSERT INTO local_statements(id,account_id,bank_id,statement_month,parsed_count,imported_count,duplicates_skipped)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,bank_id=excluded.bank_id,
      statement_month=excluded.statement_month,parsed_count=excluded.parsed_count,
      imported_count=excluded.imported_count,duplicates_skipped=excluded.duplicates_skipped`
  for (const s of p.statements ?? []) {
    queries.push(stmtSql)
    params.push([s['id'], s['accountId'], s['bankId'], s['statementMonth'], s['parsedCount'], s['importedCount'], s['duplicatesSkipped']])
  }
  const acctSql = `INSERT INTO local_accounts(id,account_name,account_type,bank_id,bank_name,currency) VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET account_name=excluded.account_name,account_type=excluded.account_type,
      bank_id=excluded.bank_id,bank_name=excluded.bank_name,currency=excluded.currency`
  for (const a of p.accounts ?? []) {
    queries.push(acctSql)
    params.push([a['id'], a['accountName'], a['accountType'], a['bankId'], a['bankName'], a['currency'] ?? 'INR'])
  }
  const ownerSql = `INSERT INTO local_owners(id,name,notes,color,is_default) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,notes=excluded.notes,color=excluded.color,is_default=excluded.is_default`
  for (const o of p.owners ?? []) {
    queries.push(ownerSql)
    params.push([o['id'], o['name'], o['notes'] ?? null, o['color'] ?? 'indigo', o['isDefault'] ? 1 : 0])
  }
  const txnOwnerSql = `INSERT INTO local_transaction_owners(transaction_id,owner_id,amount,percentage) VALUES(?,?,?,?)
    ON CONFLICT(transaction_id,owner_id) DO UPDATE SET amount=excluded.amount,percentage=excluded.percentage`
  for (const t of p.transactionOwners ?? []) {
    queries.push(txnOwnerSql)
    params.push([t['transactionId'], t['ownerId'], t['amount'], t['percentage']])
  }
  const ruleSql = `INSERT INTO local_rules(id,user_id,match_field,match_type,match_value,category_id,priority,source,is_active)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,match_field=excluded.match_field,match_type=excluded.match_type,
      match_value=excluded.match_value,category_id=excluded.category_id,priority=excluded.priority,
      source=excluded.source,is_active=excluded.is_active`
  for (const r of p.rules ?? []) {
    queries.push(ruleSql)
    params.push([r['id'], r['userId'] ?? null, r['matchField'], r['matchType'], r['matchValue'], r['categoryId'], r['priority'] ?? 500, r['source'] ?? 'user', r['isActive'] === false ? 0 : 1])
  }
  const merchSql = `INSERT INTO local_merchants(id,user_id,raw_patterns,normalized_name,default_category_id,is_system)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,raw_patterns=excluded.raw_patterns,
      normalized_name=excluded.normalized_name,default_category_id=excluded.default_category_id,is_system=excluded.is_system`
  for (const m of p.merchants ?? []) {
    queries.push(merchSql)
    params.push([m['id'], m['userId'] ?? null, JSON.stringify(m['rawPatterns'] ?? []), m['normalizedName'], m['defaultCategoryId'] ?? null, m['isSystem'] ? 1 : 0])
  }
  const invSql = `INSERT INTO local_invoices(id,name,status,invoice_month,generated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,invoice_month=excluded.invoice_month,generated_at=excluded.generated_at`
  for (const v of p.invoices ?? []) {
    queries.push(invSql)
    params.push([v['id'], v['name'], v['status'] ?? 'draft', v['invoiceMonth'], v['generatedAt'] ?? null])
  }
  const invStmtSql = `INSERT INTO local_invoice_statements(invoice_id,statement_id,account_id,statement_month,account_name,account_type)
    VALUES(?,?,?,?,?,?)`
  for (const v of p.invoiceStatements ?? []) {
    queries.push(invStmtSql)
    params.push([v['invoiceId'], v['statementId'] ?? null, v['accountId'] ?? null, v['statementMonth'], v['accountName'], v['accountType']])
  }
  const invItemSql = `INSERT INTO local_invoice_items(id,invoice_id,transaction_id,statement_id,date,description,amount,type,is_one_time,category_id,category_name,category_color,category_type,owners)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET invoice_id=excluded.invoice_id,transaction_id=excluded.transaction_id,statement_id=excluded.statement_id,
      date=excluded.date,description=excluded.description,amount=excluded.amount,type=excluded.type,is_one_time=excluded.is_one_time,
      category_id=excluded.category_id,category_name=excluded.category_name,category_color=excluded.category_color,
      category_type=excluded.category_type,owners=excluded.owners`
  for (const v of p.invoiceItems ?? []) {
    queries.push(invItemSql)
    params.push([v['id'], v['invoiceId'], v['transactionId'] ?? null, v['statementId'] ?? null, v['date'], v['description'], v['amount'], v['type'], v['isOneTime'] ? 1 : 0, v['categoryId'] ?? null, v['categoryName'] ?? 'Uncategorized', v['categoryColor'] ?? null, v['categoryType'] ?? 'expense', JSON.stringify(v['owners'] ?? [])])
  }
  const assetSql = `INSERT INTO local_assets(id,owner_id,name,type,value,currency,equity_debt_tag,metadata,valuation_date,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,name=excluded.name,type=excluded.type,value=excluded.value,
      currency=excluded.currency,equity_debt_tag=excluded.equity_debt_tag,metadata=excluded.metadata,
      valuation_date=excluded.valuation_date,created_at=excluded.created_at,updated_at=excluded.updated_at`
  for (const v of p.assets ?? []) {
    queries.push(assetSql)
    params.push([v['id'], v['ownerId'] ?? null, v['name'], v['type'], v['value'], v['currency'] ?? 'INR', v['equityDebtTag'] ?? null, JSON.stringify(v['metadata'] ?? {}), v['valuationDate'], v['createdAt'], v['updatedAt']])
  }
  const liabSql = `INSERT INTO local_liabilities(id,owner_id,name,type,outstanding_amount,interest_rate,monthly_payment,last_updated,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,name=excluded.name,type=excluded.type,
      outstanding_amount=excluded.outstanding_amount,interest_rate=excluded.interest_rate,
      monthly_payment=excluded.monthly_payment,last_updated=excluded.last_updated,created_at=excluded.created_at`
  for (const v of p.liabilities ?? []) {
    queries.push(liabSql)
    params.push([v['id'], v['ownerId'] ?? null, v['name'], v['type'], v['outstandingAmount'], v['interestRate'] ?? null, v['monthlyPayment'] ?? null, v['lastUpdated'], v['createdAt']])
  }
  const snapsSql = `INSERT INTO local_networth_snapshots(id,owner_id,snapshot_date,total_assets,total_liabilities,net_worth,asset_breakdown,liability_breakdown,notes,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,snapshot_date=excluded.snapshot_date,total_assets=excluded.total_assets,
      total_liabilities=excluded.total_liabilities,net_worth=excluded.net_worth,asset_breakdown=excluded.asset_breakdown,
      liability_breakdown=excluded.liability_breakdown,notes=excluded.notes,created_at=excluded.created_at`
  for (const v of p.netWorthSnapshots ?? []) {
    queries.push(snapsSql)
    params.push([v['id'], v['ownerId'] ?? null, v['snapshotDate'], v['totalAssets'], v['totalLiabilities'], v['netWorth'], JSON.stringify(v['assetBreakdown'] ?? null), JSON.stringify(v['liabilityBreakdown'] ?? null), v['notes'] ?? null, v['createdAt']])
  }
  const draftsSql = `INSERT INTO local_networth_drafts(id,owner_id,asset_breakdown,liability_breakdown,saved_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,asset_breakdown=excluded.asset_breakdown,
      liability_breakdown=excluded.liability_breakdown,saved_at=excluded.saved_at`
  for (const v of p.netWorthDrafts ?? []) {
    queries.push(draftsSql)
    params.push([v['id'], v['ownerId'] ?? null, JSON.stringify(v['assetBreakdown'] ?? null), JSON.stringify(v['liabilityBreakdown'] ?? null), v['savedAt']])
  }

  return { queries, params }
}

export function buildDeleteByStatement(statementId: string): OpfsBatch {
  return {
    queries: [
      'DELETE FROM local_transaction_owners WHERE transaction_id IN (SELECT id FROM local_transactions WHERE statement_id = ?)',
      'DELETE FROM local_transactions WHERE statement_id = ?',
      'DELETE FROM local_statements WHERE id = ?',
    ],
    params: [[statementId], [statementId], [statementId]],
  }
}

export function buildDeleteByIds(ids: string[]): OpfsBatch {
  if (ids.length === 0) return { queries: [], params: [] }
  const placeholders = ids.map(() => '?').join(',')
  return {
    queries: [
      `DELETE FROM local_transaction_owners WHERE transaction_id IN (${placeholders})`,
      `DELETE FROM local_transactions WHERE id IN (${placeholders})`,
    ],
    params: [ids, ids],
  }
}

export const OPFS_CLEAR_SQL =
  'DELETE FROM local_transactions; DELETE FROM local_statements; DELETE FROM local_categories;' +
  'DELETE FROM local_accounts; DELETE FROM local_owners; DELETE FROM local_transaction_owners;' +
  'DELETE FROM local_rules; DELETE FROM local_merchants; DELETE FROM local_invoices;' +
  'DELETE FROM local_invoice_statements; DELETE FROM local_invoice_items;' +
  'DELETE FROM local_assets; DELETE FROM local_liabilities;' +
  'DELETE FROM local_networth_snapshots; DELETE FROM local_networth_drafts;' +
  'DELETE FROM local_changelog;'

/** Allowed local field patches (camelCase) → columns. */
const PATCH_COLUMNS: Record<string, string> = {
  categoryId: 'category_id',
  isOneTime: 'is_one_time',
  comment: 'comment',
  merchant: 'merchant',
}

export interface TxnPatch {
  categoryId?: string | null
  isOneTime?: boolean
  comment?: string | null
  merchant?: string | null
}

/** UPDATE local_transactions … WHERE id — plus a changelog entry. */
export function buildPatchTransaction(id: string, patch: TxnPatch): OpfsBatch {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    const v = (patch as Record<string, unknown>)[key]
    if (v !== undefined) {
      sets.push(`${column} = ?`)
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v)
    }
  }
  if (sets.length === 0) return { queries: [], params: [] }
  return {
    queries: [
      `UPDATE local_transactions SET ${sets.join(', ')} WHERE id = ?`,
      `INSERT INTO local_changelog(table_name, row_id, op, created_at) VALUES('transactions', ?, 'patch', ?)`,
    ],
    params: [[...vals, id], [id, Date.now()]],
  }
}

/** Replace a transaction's owner shares (equal split, mirrors the server). */
export function buildSetOwners(
  transactionId: string,
  ownerIds: string[],
  amount: string
): OpfsBatch {
  const n = ownerIds.length
  const shareAmount = (parseFloat(amount) / n).toFixed(2)
  const sharePct = (100 / n).toFixed(2)
  const queries = ['DELETE FROM local_transaction_owners WHERE transaction_id = ?']
  const params: unknown[][] = [[transactionId]]
  for (const ownerId of ownerIds) {
    queries.push('INSERT INTO local_transaction_owners(transaction_id,owner_id,amount,percentage) VALUES(?,?,?,?)')
    params.push([transactionId, ownerId, shareAmount, sharePct])
  }
  queries.push(`INSERT INTO local_changelog(table_name, row_id, op, created_at) VALUES('transactions', ?, 'owners', ?)`)
  params.push([transactionId, Date.now()])
  return { queries, params }
}

export function buildClearChangelog(upToId: number): OpfsBatch {
  return {
    queries: ['DELETE FROM local_changelog WHERE id <= ?'],
    params: [[upToId]],
  }
}

/** Local invoice lifecycle (vault users): headers/links/items live in OPFS. */

export interface LocalInvoiceCreate {
  id: string
  name: string
  invoiceMonth: string
  statements: Array<{
    statementId: string | null
    accountId: string | null
    statementMonth: string
    accountName: string
    accountType: string
  }>
}

export function buildRewriteInvoiceLinks(invoiceId: string, statements: LocalInvoiceCreate['statements']): OpfsBatch {
  const queries = ['DELETE FROM local_invoice_statements WHERE invoice_id = ?']
  const params: unknown[][] = [[invoiceId]]
  for (const s of statements) {
    queries.push('INSERT INTO local_invoice_statements(invoice_id,statement_id,account_id,statement_month,account_name,account_type) VALUES(?,?,?,?,?,?)')
    params.push([invoiceId, s.statementId ?? null, s.accountId ?? null, s.statementMonth, s.accountName, s.accountType])
  }
  return { queries, params }
}

export function buildDeleteInvoice(invoiceId: string): OpfsBatch {
  return {
    queries: [
      'DELETE FROM local_invoice_items WHERE invoice_id = ?',
      'DELETE FROM local_invoice_statements WHERE invoice_id = ?',
      'DELETE FROM local_invoices WHERE id = ?',
    ],
    params: [[invoiceId], [invoiceId], [invoiceId]],
  }
}

export function buildDeleteInvoiceItems(invoiceId: string): OpfsBatch {
  return {
    queries: ['DELETE FROM local_invoice_items WHERE invoice_id = ?'],
    params: [[invoiceId]],
  }
}

export function buildSetInvoiceStatus(invoiceId: string, status: 'draft' | 'generated', generatedAt: string | null): OpfsBatch {
  return {
    queries: ['UPDATE local_invoices SET status = ?, generated_at = ? WHERE id = ?'],
    params: [[status, generatedAt, invoiceId]],
  }
}

export const OPFS_READ_TABLES = [
  'local_transactions',
  'local_categories',
  'local_statements',
  'local_accounts',
  'local_owners',
  'local_transaction_owners',
  'local_rules',
  'local_merchants',
  'local_invoices',
  'local_invoice_statements',
  'local_invoice_items',
  'local_assets',
  'local_liabilities',
  'local_networth_snapshots',
  'local_networth_drafts',
] as const

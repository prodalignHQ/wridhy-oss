export type SqliteDatabaseLike = {
  run?: (sql: string) => any
  exec?: (sql: string) => any
}

export function initSqliteDatabase(sqlite: SqliteDatabaseLike) {
  const execute = (sql: string) => {
    if (typeof sqlite.exec === 'function') {
      sqlite.exec(sql)
    } else if (typeof sqlite.run === 'function') {
      sqlite.run(sql)
    }
  }

  execute(`PRAGMA journal_mode = WAL;`)
  execute(`PRAGMA foreign_keys = ON;`)

  execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT,
      color TEXT NOT NULL DEFAULT 'indigo',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      icon TEXT,
      color TEXT NOT NULL DEFAULT '#6366f1',
      parent_id TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      raw_patterns TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      default_category_id TEXT REFERENCES categories(id),
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorization_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      match_field TEXT NOT NULL,
      match_type TEXT NOT NULL,
      match_value TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      priority INTEGER NOT NULL DEFAULT 500,
      source TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
      bank_id TEXT NOT NULL,
      statement_month TEXT NOT NULL,
      parsed_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      duplicates_skipped INTEGER NOT NULL DEFAULT 0,
      imported_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      date INTEGER NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT,
      amount TEXT NOT NULL,
      type TEXT NOT NULL,
      is_one_time INTEGER NOT NULL DEFAULT 0,
      category_id TEXT REFERENCES categories(id),
      comment TEXT,
      dedup_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_owners (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      percentage TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      invoice_month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      generated_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_statements (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL,
      statement_month TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
      date INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      type TEXT NOT NULL,
      is_one_time INTEGER NOT NULL DEFAULT 0,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL DEFAULT 'Uncategorized',
      category_color TEXT,
      category_type TEXT NOT NULL DEFAULT 'expense',
      owners TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id TEXT REFERENCES owners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      equity_debt_tag TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      valuation_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id TEXT REFERENCES owners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      outstanding_amount TEXT NOT NULL,
      interest_rate TEXT,
      monthly_payment TEXT,
      last_updated INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id TEXT REFERENCES owners(id) ON DELETE CASCADE,
      snapshot_date INTEGER NOT NULL,
      total_assets TEXT NOT NULL,
      total_liabilities TEXT NOT NULL,
      net_worth TEXT NOT NULL,
      asset_breakdown TEXT,
      liability_breakdown TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id TEXT REFERENCES owners(id) ON DELETE CASCADE UNIQUE,
      asset_breakdown TEXT,
      liability_breakdown TEXT,
      saved_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_blobs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cipher TEXT NOT NULL,
      nonce TEXT NOT NULL,
      salt TEXT NOT NULL,
      opslimit INTEGER NOT NULL,
      memlimit INTEGER NOT NULL,
      wrapped_dek_password TEXT,
      wrapped_dek_recovery TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_wraps (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL,
      wrapped_dek TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'Passkey',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, credential_id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_userId_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_dedupHash ON transactions(dedup_hash);
    CREATE INDEX IF NOT EXISTS idx_statements_userId ON statements(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_userId ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_rules_userId ON categorization_rules(user_id);
  `)
}

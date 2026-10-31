import type { Sql } from 'postgres'
import { ensureLocalUserAndSeed } from './local-seed.js'

export async function initPostgresDatabase(sql: Sql) {
  // Check if users table already exists
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    );
  `

  if (tableCheck[0]?.exists) {
    return
  }

  console.log('📦 First-time PostgreSQL initialization: creating schemas, tables, and indexes...')

  await sql.unsafe(`
    -- Create ENUM types safely if not exist
    DO $$ BEGIN
      CREATE TYPE "account_type" AS ENUM('bank', 'credit_card', 'wallet', 'investment');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "transaction_type" AS ENUM('debit', 'credit');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "rule_source" AS ENUM('system', 'user');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "match_field" AS ENUM('merchant', 'description', 'amount');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "match_type" AS ENUM('contains', 'equals', 'regex', 'gt', 'lt');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "asset_type" AS ENUM(
        'mutual_fund', 'stock', 'fixed_deposit', 'recurring_deposit', 'ppf',
        'savings_account', 'real_estate', 'crypto', 'cash', 'other'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "liability_type" AS ENUM('home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "owner_type" AS ENUM('person', 'shared', 'household');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "category_type" AS ENUM('expense', 'investment', 'income', 'transfer');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "invoice_status" AS ENUM('draft', 'generated');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Tables
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      image TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMP,
      refresh_token_expires_at TIMESTAMP,
      scope TEXT,
      password TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type "owner_type" DEFAULT 'person' NOT NULL,
      color TEXT DEFAULT 'indigo' NOT NULL,
      is_default BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_name TEXT NOT NULL,
      account_type "account_type" NOT NULL,
      bank_name TEXT NOT NULL,
      currency TEXT DEFAULT 'INR' NOT NULL,
      is_deleted BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT DEFAULT '#6366f1' NOT NULL,
      type "category_type" DEFAULT 'expense' NOT NULL,
      parent_id UUID,
      is_system BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      raw_patterns JSONB NOT NULL,
      normalized_name TEXT NOT NULL,
      default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      is_system BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorization_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      match_field "match_field" NOT NULL,
      match_type "match_type" NOT NULL,
      match_value TEXT NOT NULL,
      category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      priority INTEGER DEFAULT 500 NOT NULL,
      source "rule_source" DEFAULT 'user' NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
      bank_id TEXT NOT NULL,
      statement_month DATE NOT NULL,
      parsed_count INTEGER DEFAULT 0 NOT NULL,
      imported_count INTEGER DEFAULT 0 NOT NULL,
      duplicates_skipped INTEGER DEFAULT 0 NOT NULL,
      imported_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
      statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
      date TIMESTAMP NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT,
      amount NUMERIC(15, 2) NOT NULL,
      type "transaction_type" NOT NULL,
      category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      comment TEXT,
      dedup_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_owners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
      amount NUMERIC(15, 2) NOT NULL,
      percentage NUMERIC(5, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      invoice_month DATE NOT NULL,
      status "invoice_status" DEFAULT 'draft' NOT NULL,
      generated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_statements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
      account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
      statement_month DATE NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
      statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
      date TIMESTAMP NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(15, 2) NOT NULL,
      type "transaction_type" NOT NULL,
      category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      category_name TEXT DEFAULT 'Uncategorized' NOT NULL,
      category_color TEXT,
      owners JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type "asset_type" NOT NULL,
      value NUMERIC(15, 2) NOT NULL,
      currency TEXT DEFAULT 'INR' NOT NULL,
      valuation_date TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS liabilities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type "liability_type" NOT NULL,
      outstanding_amount NUMERIC(15, 2) NOT NULL,
      interest_rate NUMERIC(5, 2),
      monthly_payment NUMERIC(15, 2),
      last_updated TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
      snapshot_date TIMESTAMP NOT NULL,
      total_assets NUMERIC(15, 2) NOT NULL,
      total_liabilities NUMERIC(15, 2) NOT NULL,
      net_worth NUMERIC(15, 2) NOT NULL,
      asset_breakdown JSONB,
      liability_breakdown JSONB,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_drafts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE UNIQUE,
      asset_breakdown JSONB,
      liability_breakdown JSONB,
      saved_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_year_incomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
      financial_year TEXT NOT NULL,
      gross_income NUMERIC(15, 2) NOT NULL,
      tax_paid NUMERIC(15, 2) DEFAULT '0' NOT NULL,
      net_income NUMERIC(15, 2) NOT NULL,
      breakdown JSONB DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salary_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      role TEXT NOT NULL,
      employment_type TEXT DEFAULT 'full_time' NOT NULL,
      currency TEXT DEFAULT 'INR' NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      status TEXT DEFAULT 'active' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salary_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      salary_source_id UUID NOT NULL REFERENCES salary_sources(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      effective_date TIMESTAMP NOT NULL,
      annual_ctc NUMERIC(15, 2) NOT NULL,
      base_salary NUMERIC(15, 2),
      monthly_in_hand NUMERIC(15, 2),
      variable_pay NUMERIC(15, 2) DEFAULT '0',
      stock_grant NUMERIC(15, 2) DEFAULT '0',
      hike_percentage NUMERIC(6, 2),
      hike_type TEXT DEFAULT 'annual_review' NOT NULL,
      designation TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_transactions_userId_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_dedupHash ON transactions(dedup_hash);
    CREATE INDEX IF NOT EXISTS idx_statements_userId ON statements(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_userId ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_rules_userId ON categorization_rules(user_id);
    CREATE INDEX IF NOT EXISTS idx_fy_incomes_userId ON financial_year_incomes(user_id);
    CREATE INDEX IF NOT EXISTS idx_salary_sources_userId ON salary_sources(user_id);
    CREATE INDEX IF NOT EXISTS idx_salary_revisions_sourceId ON salary_revisions(salary_source_id);
  `)

  console.log('✅ PostgreSQL database tables and indexes initialized.')
}

export async function ensurePostgresInitAndSeed(sql: Sql) {
  try {
    await initPostgresDatabase(sql)
    await ensureLocalUserAndSeed()
  } catch (err) {
    console.error('Error during PostgreSQL initialization/seeding:', err)
  }
}

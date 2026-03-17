# MoMoney — Technical Architecture Plan

**Version:** v1.0  
**Status:** Draft  
**Last Updated:** March 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Operating Modes & Local-First Design](#4-operating-modes--local-first-design)
   - [4.4 Mode Switching in SaaS Context](#44-mode-switching-in-saas-context)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Statement Parsing Engine](#7-statement-parsing-engine)
8. [Categorization & Rules Engine](#8-categorization--rules-engine)
9. [Net Worth Module](#9-net-worth-module)
10. [API Design](#10-api-design)
11. [Data Models](#11-data-models)
12. [Security & Privacy](#12-security--privacy)
13. [Deployment Architecture](#13-deployment-architecture) — *Cloudflare Pages + Railway*
14. [Future Mobile Considerations](#14-future-mobile-considerations)

---

## 1. Architecture Overview

MoMoney is a **privacy-first personal finance platform** built on a JS-based stack. The architecture is:

- **API-first**: Backend is a standalone REST/JSON API, deployable independently
- **Local-first**: Processing and storage happens in-browser by default; cloud is opt-in
- **Cross-platform ready**: Web today, mobile tomorrow — same backend serves both

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│   ┌──────────────────┐         ┌──────────────────────┐    │
│   │   Web App        │         │  Mobile App (Future) │    │
│   │  (React/Next.js) │         │  (React Native)      │    │
│   └────────┬─────────┘         └──────────┬───────────┘    │
└────────────┼──────────────────────────────┼────────────────┘
             │                              │
             │         REST API (HTTPS)     │
             ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Server (Hono.js)                      │
│              Deployed on Node.js / Cloudflare Workers        │
├─────────────────────────────────────────────────────────────┤
│ Auth │ Statements │ Transactions │ Invoices │ Insights │ NW │
└──┬───┘─────┬──────┘──────┬───────┘────┬─────┘────┬──────┘──┬─┘
   │         │             │            │          │         │
   ▼         ▼             ▼            ▼          ▼         ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL (Cloud Mode)                    │
│            (Encrypted at column-level for sensitive data)    │
└─────────────────────────────────────────────────────────────┘

Local Mode:
┌─────────────────────────────────────────────────────────────┐
│   Browser                                                   │
│   ┌─────────────────┐    ┌────────────────────────────┐    │
│   │  In-Memory Store │    │  SQLite (via sql.js/OPFS)  │    │
│   │    (Zustand)     │    │  (Local SQLite Mode)       │    │
│   └─────────────────┘    └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

### 2.1 Frontend

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Next.js 14+ (App Router)** | File-based routing, SSR/SSG, React Server Components. Easy to deploy on Vercel or self-host. Strong ecosystem. Future: can extract React Native components. |
| State Management | **Zustand** | Lightweight, supports in-memory stores for session mode elegantly |
| Local DB (browser) | **sql.js + OPFS** (Origin Private File System) | Full SQLite in browser via WASM. OPFS enables persistent, performant file access. |
| Charting | **Recharts** | React-native charts, easy API |
| File Parsing (client) | **SheetJS (xlsx)** + **PapaParse** | Parse Excel/CSV in-browser before any server upload |
| UI Library | **shadcn/ui** + **Tailwind CSS** | Accessible, composable components; mobile-ready |
| Form Handling | **React Hook Form** + **Zod** | Type-safe forms with validation |
| HTTP Client | **ky** or **fetch** with a typed wrapper | Minimal, modern HTTP client |
| Date Handling | **date-fns** | Lightweight, tree-shakable |

### 2.2 Backend

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | **Node.js 20+** | LTS, wide hosting support |
| Framework | **Hono.js** | Lightweight, edge-compatible, typed routing. Works on Node.js, Cloudflare Workers, Bun. API-first design. |
| Language | **TypeScript** | End-to-end type safety |
| ORM | **Drizzle ORM** | Type-safe, lightweight, works with both PostgreSQL and SQLite (shared schema) |
| Database | **PostgreSQL** (cloud mode) | ACID-compliant, JSON support, encryption extensions |
| Auth | **Better Auth** or **Lucia Auth** | JS-native auth libraries with session & JWT support |
| File Handling | **Multer** (Node, in-memory only) | Parse uploaded files in RAM; never written to disk or object storage |
| Validation | **Zod** | Shared schemas between frontend and backend |
| PDF Parsing | **pdf-parse** / **pdf2json** | For future PDF support |
| Excel/CSV Parsing | **SheetJS (xlsx)** + **PapaParse** | Server-side parsing of uploaded statements |

### 2.3 Infrastructure & DevOps

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend Hosting | **Cloudflare Pages** | Free tier with no bandwidth limits; supports Next.js via `@cloudflare/next-on-pages` |
| Backend Hosting | **Railway** | Predictable pay-as-you-go pricing (~$5–10/mo to start); includes PostgreSQL add-on |
| Database Hosting | **Railway PostgreSQL** | Bundled with Railway — no separate vendor or bill |
| Secrets | **Railway env vars** | Built-in to Railway — no separate secrets tool needed |
| CI/CD | **GitHub Actions** | Free for small/private repos |
| Monorepo | **Turborepo** | Shared types/schemas between frontend, backend, mobile |

> **One vendor, one bill.** Railway covers backend + database. Cloudflare Pages covers the frontend for free. No S3/R2, no Neon, no Doppler.

> **No file storage (S3/R2) needed.** Statement files (CSV/Excel) are parsed in-memory and immediately discarded. Only the extracted transaction rows are persisted. This reduces cost, complexity, and privacy surface area.

---

## 3. System Architecture

### 3.1 Monorepo Structure

```
momoney/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Hono.js backend
├── packages/
│   ├── db/               # Drizzle schema, migrations (shared)
│   ├── parsers/          # Statement parsers (per-bank)
│   ├── rules-engine/     # Categorization rules engine
│   ├── types/            # Shared TypeScript types & Zod schemas
│   └── utils/            # Shared utilities
├── docs/
│   ├── PRD.md
│   └── TECH_PLAN.md
├── turbo.json
└── package.json
```

### 3.2 Data Flow

**Session Mode (no server storage):**
```
User uploads file → Browser parses CSV/Excel → Zustand store → 
Rules Engine (client-side) → Categorized transactions in memory → 
Invoice drafts/generated invoices stored in-memory → 
Analytics computed locally → Export to SQLite/CSV/JSON
```

**Cloud Mode:**
```
User uploads file → Browser validates + previews → 
POST /statements/upload → Server parses → Stores encrypted in PostgreSQL → 
GET /transactions + /invoices → Frontend renders → 
Invoice analysis + insights computed server-side
```

**Local SQLite Mode:**
```
User uploads file → Browser parses → sql.js (OPFS) → 
Rules Engine (client-side) → Invoice drafts/generated invoices in SQLite → 
Analytics → Import/Export SQLite file
```

---

## 4. Operating Modes & Local-First Design

### 4.1 Mode Detection & Switching

A `StorageMode` context in the frontend determines how data flows:

```typescript
type StorageMode = 'session' | 'local-sqlite' | 'cloud'
```

All data access goes through an **adapter pattern**:

```typescript
interface DataAdapter {
  getTransactions(filters?: TransactionFilters): Promise<Transaction[]>
  saveTransactions(txns: Transaction[]): Promise<void>
  getInvoices(): Promise<Invoice[]>
  saveInvoiceDraft(input: InvoiceDraftInput): Promise<Invoice>
  generateInvoice(invoiceId: string): Promise<Invoice>
  getNetWorth(): Promise<NetWorthEntry[]>
  // ...
}

class SessionAdapter implements DataAdapter { /* Zustand store */ }
class SQLiteAdapter implements DataAdapter { /* sql.js / OPFS */ }
class CloudAdapter implements DataAdapter { /* REST API calls */ }
```

This means switching modes is a configuration change, not a rewrite.

### 4.2 SQLite Schema Mirroring

The same Drizzle schema drives both PostgreSQL (cloud) and SQLite (local). The `packages/db` package exports schemas compatible with both dialects. This means:
- Migrations run on PostgreSQL in production
- The same schema file is used to initialize sql.js in the browser
- Data portability (SQLite ↔ Cloud) is schema-guaranteed

### 4.3 Data Migration Flows

| From | To | Mechanism |
|------|----|-----------|
| Session | SQLite | Dump Zustand store → Insert into sql.js |
| Session | Cloud | POST /import with JSON payload |
| SQLite | Cloud | Upload SQLite file → Server imports |
| Cloud | SQLite | GET /export/sqlite → Download file |
| Cloud | SQLite (SaaS) | User downloads `.sqlite` from Settings → loaded into OPFS → adapter switches |
| SQLite (SaaS) | Cloud | User uploads `.sqlite` from Settings → `/v1/import/sqlite` ingests rows |

### 4.4 Mode Switching in SaaS Context

A key question for the SaaS model is: **can a logged-in user switch between cloud storage and local SQLite?** The answer is yes — and this is a deliberate design goal.

#### The Core Principle

> **Auth always lives in the cloud. Financial data is portable.**

Even in SQLite mode, the user's account (credentials, preferences, settings) remains on your server. Only the financial records — transactions, statements, invoices, net worth entries, rules — can be held locally instead.

```
┌───────────────────────────────────────────────────────────────────┐
│                     SaaS Account (always cloud)                   │
│  user profile · email · preferences · system rules · categories   │
├───────────────────────────────────────────────────────────────────┤
│           Financial Data Layer  (user's choice)                   │
│                                                                   │
│   ┌─────────────────────┐    ←→    ┌────────────────────────┐    │
│   │   Cloud Storage     │          │  Local SQLite (OPFS)   │    │
│   │  (PostgreSQL)       │          │  sql.js in browser     │    │
│   └─────────────────────┘          └────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

#### Switching Cloud → Local SQLite (SaaS user wants more privacy)

```
1. User goes to Settings → Storage → "Switch to Local SQLite"
2. App calls GET /v1/export/sqlite  
3. Server streams a .sqlite file of all their financial data
4. Browser receives the file, loads it into OPFS via sql.js
5. StorageMode is updated to 'local-sqlite' (persisted in localStorage)
6. CloudAdapter is swapped for SQLiteAdapter — all reads/writes now go local
7. Server-side financial data is optionally deleted (user prompted)
```

#### Switching Local SQLite → Cloud (SaaS user wants sync back)

```
1. User goes to Settings → Storage → "Sync to Cloud"
2. Browser reads the local .sqlite file from OPFS
3. App calls POST /v1/import/sqlite with the file
4. Server merges data (dedup via dedupHash) into PostgreSQL
5. StorageMode is updated to 'cloud'
6. SQLiteAdapter is swapped for CloudAdapter
```

#### UX in the SaaS Settings Page

```
Settings → Storage Mode

  ● Cloud Storage (current)
    Your financial data is securely stored and encrypted on our servers.
    Access from any device.
    [Switch to Local SQLite]

  ○ Local SQLite
    Your financial data stays only in this browser.
    We have zero access to your finances.
    [Download my data & go local]

Data Portability
  [Export as SQLite]  [Export as JSON]  [Export as CSV]
  [Delete all my financial data from cloud]
```

#### Edge Cases & Constraints

| Scenario | Behaviour |
|----------|-----------|
| User clears browser data | Local SQLite is lost; they must re-import from a backup |
| User opens app on another device (SQLite mode) | New empty SQLite; they must import their `.sqlite` backup file |
| Merge conflict on SQLite → Cloud import | `dedupHash` handles deduplication; newer `updatedAt` wins for edits |
| User deletes cloud data after switching to SQLite | Cloud rows deleted; local copy is the only source of truth |

> **Design implication**: In SQLite mode, remind users to periodically export a backup, since browser storage is not guaranteed to persist forever (browser updates, device loss, etc.).

---

## 5. Backend Architecture

### 5.1 API Server (Hono.js)

```
apps/api/
├── src/
│   ├── index.ts           # Entry point
│   ├── middleware/
│   │   ├── auth.ts        # JWT / session middleware
│   │   ├── cors.ts
│   │   └── rateLimit.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── accounts.ts
│   │   ├── statements.ts
│   │   ├── transactions.ts
│   │   ├── invoices.ts
│   │   ├── categories.ts
│   │   ├── rules.ts
│   │   ├── merchants.ts
│   │   ├── insights.ts
│   │   └── networth.ts
│   ├── services/
│   │   ├── parser.service.ts
│   │   ├── categorization.service.ts
│   │   ├── invoices.service.ts
│   │   ├── insights.service.ts
│   │   └── networth.service.ts
│   └── db/
│       └── index.ts       # Drizzle client
```

### 5.2 Authentication

- **Session Mode**: No auth required. Stateless.
- **Cloud Mode**: JWT-based auth via `Better Auth` or `Lucia Auth`
  - Access token (short-lived, 15min)
  - Refresh token (long-lived, 30 days, httpOnly cookie)
  - Future: Google OAuth, Apple Sign-In

### 5.3 Multi-tenancy & Data Isolation

Every database table with user data includes a `user_id` column. All queries are scoped by `user_id` from the JWT. No cross-user data leakage is possible at the ORM level.

---

## 6. Frontend Architecture

### 6.1 Next.js App Router Structure

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing / Mode selection
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── dashboard/page.tsx      # Monthly spend overview
│   │   ├── transactions/page.tsx   # Transaction table
│   │   ├── statements/page.tsx     # Upload & manage statements
│   │   ├── invoices/page.tsx       # Draft + generated invoices
│   │   ├── insights/page.tsx       # Historical analytics
│   │   ├── networth/page.tsx       # Net worth tracker
│   │   ├── accounts/page.tsx       # Financial accounts
│   │   ├── rules/page.tsx          # User-defined rules
│   │   └── settings/page.tsx       # Mode, export, etc.
│   └── api/                        # Next.js API routes (if needed)
├── components/
│   ├── ui/                         # shadcn base components
│   ├── invoices/
│   ├── transactions/
│   ├── charts/
│   ├── networth/
│   └── statements/
├── lib/
│   ├── adapters/                   # DataAdapter implementations
│   ├── parsers/                    # Client-side parsers
│   └── store/                      # Zustand stores
```

### 6.2 Storage Mode Context

```typescript
// Provided at app root, persisted in localStorage
const StorageModeContext = createContext<{
  mode: StorageMode
  setMode: (mode: StorageMode) => void
  adapter: DataAdapter
}>()
```

---

## 7. Statement Parsing Engine

### 7.1 Design Principles

Each bank has its own CSV/Excel format. The parser system is **bank-specific and pluggable**:

```
packages/parsers/
├── index.ts              # Parser registry
├── base.parser.ts        # Abstract base parser
├── banks/
│   ├── hdfc.parser.ts
│   ├── icici.parser.ts
│   ├── sbi.parser.ts
│   ├── axis.parser.ts
│   └── kotak.parser.ts
└── types.ts              # ParsedTransaction type
```

### 7.2 Parser Interface

```typescript
interface BankParser {
  bankId: string
  bankName: string
  supportedFormats: ('csv' | 'xlsx' | 'pdf')[]
  parse(fileBuffer: ArrayBuffer): Promise<ParsedTransaction[]>
}

interface ParsedTransaction {
  date: Date
  description: string
  amount: number
  type: 'debit' | 'credit'
  rawDescription: string
  balance?: number
}
```

### 7.3 Parser Registry

```typescript
const parserRegistry: Record<string, BankParser> = {
  hdfc: new HDFCParser(),
  icici: new ICICIParser(),
  sbi: new SBIParser(),
  // ...
}

function getParser(bankId: string): BankParser {
  return parserRegistry[bankId] ?? throw new Error(`No parser for ${bankId}`)
}
```

### 7.4 Upload Flow

Statement files are **never stored** — they are parsed in-memory and discarded. Only the extracted transaction rows are saved.

```
1. User selects bank from dropdown
2. User uploads CSV/Excel file
3. Client-side: File is read into ArrayBuffer (never sent to server in session/SQLite modes)
4. Client-side: Parser runs → produces ParsedTransaction[]
5. Client-side: Preview shown (first N rows from parsed data, no storage needed)
6. User confirms import
7. Depending on mode:
   a. Session:  Insert ParsedTransaction[] into Zustand store
   b. SQLite:   Insert ParsedTransaction[] into sql.js (OPFS)
   c. Cloud:    POST /statements/upload (multipart) → server parses file in RAM
               → transactions inserted into PostgreSQL → file buffer discarded
8. Tagged statements become available for monthly invoice draft creation
```

> In **cloud mode**, the raw file is held in server RAM only for the duration of parsing (milliseconds). It is never written to disk or any object store.

### 7.5 Multi-Statement Support

Users can upload multiple statements (different banks, different months) in a session. Each statement is tagged with:
- `bankId`
- `accountId` 
- `statementMonth`

The transaction table deduplicates using a composite key of `(account_id, date, amount, description_hash)`.

Invoices are built on top of this month tagging:
- A draft invoice is scoped to one `statementMonth`
- A draft may include multiple statements for that month
- Those statements may belong to different accounts or banks
- Generated invoices freeze a snapshot of the selected statement transactions at generation time

---

## 8. Categorization & Rules Engine

### 8.1 Architecture

The rules engine runs **client-side** (for session/SQLite mode) and **server-side** (for cloud mode). It lives in `packages/rules-engine`.

### 8.2 Rule Types & Priority

Rules are evaluated in priority order: **User Rules → System Rules → Merchant Dictionary → Default**

```typescript
type RuleType = 'system' | 'user'

interface CategorizationRule {
  id: string
  type: RuleType
  matchField: 'merchant' | 'description' | 'amount'
  matchType: 'contains' | 'equals' | 'regex' | 'gt' | 'lt'
  matchValue: string
  categoryId: string
  priority: number          // Lower = higher priority
  source: 'system' | 'user' // user rules always beat system rules
}
```

**Priority tiers:**
| Tier | Source | Priority Range |
|------|--------|----------------|
| 1 | User-defined rules | 1–999 |
| 2 | System rules | 1000–4999 |
| 3 | Merchant dictionary lookup | 5000 |
| 4 | Default (Uncategorized) | 9999 |

### 8.3 Merchant Normalization

Before categorization, raw descriptions are normalized:

```typescript
interface MerchantRecord {
  id: string
  rawPatterns: string[]     // e.g. ["AMZN MKTP", "Amazon Pay", "AMAZON"]
  normalizedName: string    // e.g. "Amazon"
  defaultCategory: string   // e.g. "Shopping"
  type: 'system' | 'user'
}
```

User-defined merchant mappings override system mappings.

### 8.4 Rule Evaluation

```typescript
function categorize(txn: ParsedTransaction, rules: CategorizationRule[]): string {
  const sorted = rules.sort((a, b) => {
    // User rules always before system rules
    if (a.source !== b.source) return a.source === 'user' ? -1 : 1
    return a.priority - b.priority
  })

  for (const rule of sorted) {
    if (matches(txn, rule)) return rule.categoryId
  }

  return 'uncategorized'
}
```

### 8.5 Invoice Generation Flow

Invoices are a first-class monthly workflow layered on top of statements, categories, and owner splits.

**Draft model:**
- A draft invoice is created from one or more statements that share the same `statementMonth`
- The draft stores invoice metadata (`name`, `status`, `invoiceMonth`) and the selected `statementIds`
- While a draft is open, category and owner edits continue to update the underlying transactions

**Generation model:**
- Generating an invoice creates an immutable snapshot of the selected transactions
- Each snapshot row stores the transaction amount, debit/credit type, category at generation time, and owner split amounts
- This protects generated invoices from drifting when later transaction edits happen elsewhere

**Analysis model:**
- Invoice analysis uses **debit transactions only** for spend calculations
- "Who spent how much?" is computed by summing owner split amounts across debit rows
- "Who spent how much in each category?" is computed by summing those same owner split amounts grouped by category
- Credits remain visible in the invoice transaction list, but they do not contribute to spend analysis

---

## 9. Net Worth Module

### 9.1 Data Entry

Users enter net worth data in two ways:

1. **Quick Entry**: Total assets + total liabilities → net worth auto-calculated
2. **Detailed Entry**: Individual assets and liabilities with types and values

### 9.2 Asset & Liability Tracking

```typescript
// User inputs individual assets
interface Asset {
  id: string
  userId: string
  name: string
  type: 'bank_account' | 'investment' | 'real_estate' | 'crypto' | 'cash' | 'other'
  value: number
  currency: string
  valuationDate: Date
}

// User inputs individual liabilities
interface Liability {
  id: string
  userId: string
  name: string
  type: 'home_loan' | 'car_loan' | 'credit_card' | 'student_loan' | 'personal_loan' | 'other'
  outstandingAmount: number
  interestRate?: number
  monthlyPayment?: number
  lastUpdated: Date
}
```

Net worth is computed as:

```
Net Worth = SUM(assets[].value) - SUM(liabilities[].outstandingAmount)
```

### 9.3 Monthly Snapshot

Each time the user saves their net worth data, a snapshot is recorded:

```typescript
interface NetWorthSnapshot {
  id: string
  userId: string
  snapshotDate: Date          // Month + Year
  totalAssets: number
  totalLiabilities: number
  netWorth: number            // Derived: totalAssets - totalLiabilities
  assetBreakdown: AssetBreakdown[]
  liabilityBreakdown: LiabilityBreakdown[]
  notes?: string
}
```

This drives the historical net worth timeline chart.

---

## 10. API Design

### 10.1 Base URL & Versioning

```
https://api.momoney.app/v1/
```

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 500 }
}
```

Errors:
```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "..." }
}
```

### 10.2 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/signup` | Register new user |
| POST | `/v1/auth/login` | Login, returns access + refresh token |
| POST | `/v1/auth/logout` | Invalidate session |
| POST | `/v1/auth/refresh` | Rotate access token |
| POST | `/v1/auth/forgot-password` | Trigger password reset |

### 10.3 Financial Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/accounts` | List user's accounts |
| POST | `/v1/accounts` | Create new account |
| PATCH | `/v1/accounts/:id` | Update account |
| DELETE | `/v1/accounts/:id` | Delete account |

**POST /v1/accounts body:**
```json
{
  "accountName": "HDFC Savings",
  "accountType": "bank",
  "bankName": "HDFC",
  "currency": "INR"
}
```

### 10.4 Statements

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/statements/upload` | Upload + parse statement |
| GET | `/v1/statements` | List uploaded statements |
| GET | `/v1/statements/:id` | Get statement details |
| DELETE | `/v1/statements/:id` | Delete statement + transactions |

**POST /v1/statements/upload:**
```
Content-Type: multipart/form-data
Fields:
  - file: <CSV or XLSX file>   ← parsed in RAM, never stored
  - bankId: "hdfc" | "icici" | "sbi" | ...
  - accountId: string
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statementId": "stmt_abc",
    "parsedCount": 124,
    "importedCount": 121,
    "duplicatesSkipped": 3
  }
}
```

> The raw file is not stored. `statementId` is a record of the import event (bank, account, date range), not a reference to a stored file.

### 10.5 Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/transactions` | List transactions (with filters) |
| GET | `/v1/transactions/:id` | Get single transaction |
| PATCH | `/v1/transactions/:id` | Update transaction |
| POST | `/v1/transactions/:id/categorize` | Override category |
| POST | `/v1/transactions/:id/split` | Split transaction across owners |
| GET | `/v1/transactions/export` | Export as CSV/JSON |

**GET /v1/transactions query params:**
```
?accountId=acc_123
&categoryId=cat_456
&startDate=2025-01-01
&endDate=2025-12-31
&ownerId=owner_789
&search=amazon
&page=1
&limit=50
```

### 10.6 Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/categories` | List all categories (system + user) |
| POST | `/v1/categories` | Create user-defined category |
| PATCH | `/v1/categories/:id` | Update user category |
| DELETE | `/v1/categories/:id` | Delete user category |

### 10.7 Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/rules` | List all rules (system + user) |
| POST | `/v1/rules` | Create user rule |
| PATCH | `/v1/rules/:id` | Update user rule |
| DELETE | `/v1/rules/:id` | Delete user rule |
| POST | `/v1/rules/preview` | Preview what rule would categorize |

**System rules are read-only.** Users cannot modify or delete them; they can only create higher-priority user rules to override.

### 10.8 Merchants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/merchants` | List merchants (system + user-defined) |
| POST | `/v1/merchants` | Create user merchant mapping |
| PATCH | `/v1/merchants/:id` | Update user merchant |
| DELETE | `/v1/merchants/:id` | Delete user merchant mapping |

**POST /v1/merchants body:**
```json
{
  "rawPatterns": ["AMZN MKTP", "Amazon Pay"],
  "normalizedName": "Amazon",
  "defaultCategoryId": "cat_shopping"
}
```

User-defined merchant records take precedence over system records.

### 10.9 Owners

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/owners` | List transaction owners |
| POST | `/v1/owners` | Create owner |
| PATCH | `/v1/owners/:id` | Update owner |
| DELETE | `/v1/owners/:id` | Delete owner |

### 10.10 Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/invoices` | List draft and generated invoices |
| POST | `/v1/invoices` | Create an invoice draft from tagged statements |
| GET | `/v1/invoices/:id` | Get invoice detail, transactions, and analysis |
| PATCH | `/v1/invoices/:id` | Rename draft or update selected statements |
| POST | `/v1/invoices/:id/generate` | Freeze snapshot and mark invoice generated |

**POST /v1/invoices body:**
```json
{
  "name": "March Household Invoice",
  "invoiceMonth": "2026-03-01",
  "statementIds": ["stmt_1", "stmt_2", "stmt_3"]
}
```

**Rules:**
- All `statementIds` must belong to the same tagged `invoiceMonth`
- A draft invoice may be reopened until generation
- A generated invoice returns both the frozen transaction snapshot and the derived analysis blocks

### 10.11 Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/insights/monthly` | Monthly spend summary |
| GET | `/v1/insights/yearly` | Year-over-year summary |
| GET | `/v1/insights/categories` | Category breakdown |
| GET | `/v1/insights/merchants` | Top merchants |
| GET | `/v1/insights/owners` | Spend by owner |

**GET /v1/insights/monthly query params:**
```
?month=2025-03
&accountIds=acc1,acc2    (optional: filter by accounts)
&ownerIds=own1,own2      (optional: filter by owners)
```

### 10.12 Net Worth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/networth` | Current net worth summary |
| GET | `/v1/networth/history` | Historical snapshots |
| POST | `/v1/networth/snapshot` | Save a net worth snapshot |
| GET | `/v1/assets` | List assets |
| POST | `/v1/assets` | Add asset |
| PATCH | `/v1/assets/:id` | Update asset |
| DELETE | `/v1/assets/:id` | Delete asset |
| GET | `/v1/liabilities` | List liabilities |
| POST | `/v1/liabilities` | Add liability |
| PATCH | `/v1/liabilities/:id` | Update liability |
| DELETE | `/v1/liabilities/:id` | Delete liability |

### 10.13 Data Portability

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/export/sqlite` | Download full SQLite database |
| GET | `/v1/export/json` | Export all data as JSON |
| GET | `/v1/export/csv` | Export transactions as CSV |
| POST | `/v1/import/sqlite` | Import from SQLite file |
| POST | `/v1/import/json` | Import from JSON export |

---

## 11. Data Models

### 11.1 Core Tables (Drizzle Schema)

```typescript
// users
users {
  id            uuid PRIMARY KEY
  email         text UNIQUE NOT NULL
  passwordHash  text
  createdAt     timestamp DEFAULT now()
  storageMode   enum('session','local','cloud') DEFAULT 'session'
}

// financial_accounts
financialAccounts {
  id          uuid PRIMARY KEY
  userId      uuid REFERENCES users(id)
  accountName text NOT NULL
  accountType enum('bank','credit_card','wallet','investment')
  bankId      text   -- maps to parser registry key
  bankName    text
  currency    text DEFAULT 'INR'
  createdAt   timestamp DEFAULT now()
}

// statements  (import event log only — no raw file stored)
statements {
  id             uuid PRIMARY KEY
  userId         uuid REFERENCES users(id)
  accountId      uuid REFERENCES financialAccounts(id)
  bankId         text NOT NULL
  originalFileName text          -- stored for display only
  parsedCount    int
  importedCount  int
  duplicatesSkipped int DEFAULT 0
  statementMonth date             -- YYYY-MM-01
  uploadedAt     timestamp DEFAULT now()
}

// transactions
transactions {
  id              uuid PRIMARY KEY
  userId          uuid REFERENCES users(id)
  statementId     uuid REFERENCES statements(id)
  accountId       uuid REFERENCES financialAccounts(id)
  date            date NOT NULL
  description     text NOT NULL
  rawDescription  text
  amount          numeric(15,2) NOT NULL
  type            enum('debit','credit')
  merchantId      uuid REFERENCES merchants(id)
  categoryId      uuid REFERENCES categories(id)
  isManualCategory boolean DEFAULT false
  comment         text
  dedupHash       text UNIQUE  -- hash(accountId+date+amount+description)
  createdAt       timestamp DEFAULT now()
}

// transaction_owners (split support)
transactionOwners {
  id             uuid PRIMARY KEY
  transactionId  uuid REFERENCES transactions(id)
  ownerId        uuid REFERENCES owners(id)
  amount         numeric(15,2)
  percentage     numeric(5,2)
}

// invoices
invoices {
  id               uuid PRIMARY KEY
  userId           uuid REFERENCES users(id)
  name             text NOT NULL
  status           enum('draft','generated')
  invoiceMonth     date NOT NULL      -- YYYY-MM-01
  statementCount   int DEFAULT 0
  transactionCount int DEFAULT 0
  debitTotal       numeric(15,2)
  creditTotal      numeric(15,2)
  generatedAt      timestamp NULLABLE
  createdAt        timestamp DEFAULT now()
  updatedAt        timestamp DEFAULT now()
}

// invoice_statements
invoiceStatements {
  id          uuid PRIMARY KEY
  invoiceId   uuid REFERENCES invoices(id)
  statementId uuid REFERENCES statements(id)
  createdAt   timestamp DEFAULT now()
}

// invoice_transaction_snapshots
invoiceTransactionSnapshots {
  id              uuid PRIMARY KEY
  invoiceId       uuid REFERENCES invoices(id)
  transactionId   uuid REFERENCES transactions(id) NULLABLE
  statementId     uuid REFERENCES statements(id) NULLABLE
  accountName     text
  statementMonth  date
  transactionDate date NOT NULL
  description     text NOT NULL
  amount          numeric(15,2) NOT NULL
  type            enum('debit','credit')
  categoryId      uuid REFERENCES categories(id) NULLABLE
  categoryName    text
  categoryColor   text
  ownerSplits     jsonb            -- [{ ownerId, name, color, amount, percentage }]
  createdAt       timestamp DEFAULT now()
}

// categories
categories {
  id          uuid PRIMARY KEY
  userId      uuid REFERENCES users(id) NULLABLE  -- null = system category
  name        text NOT NULL
  icon        text
  color       text
  type        enum('system','user') DEFAULT 'user'
  parentId    uuid REFERENCES categories(id) NULLABLE
}

// merchants
merchants {
  id              uuid PRIMARY KEY
  userId          uuid REFERENCES users(id) NULLABLE  -- null = system merchant
  normalizedName  text NOT NULL
  rawPatterns     text[]
  defaultCategoryId uuid REFERENCES categories(id)
  type            enum('system','user') DEFAULT 'user'
}

// categorization_rules
categorizationRules {
  id          uuid PRIMARY KEY
  userId      uuid REFERENCES users(id) NULLABLE  -- null = system rule
  type        enum('system','user')
  matchField  enum('merchant','description','amount')
  matchType   enum('contains','equals','regex','gt','lt')
  matchValue  text NOT NULL
  categoryId  uuid REFERENCES categories(id)
  priority    int NOT NULL
  isActive    boolean DEFAULT true
  createdAt   timestamp DEFAULT now()
}

// owners
owners {
  id      uuid PRIMARY KEY
  userId  uuid REFERENCES users(id)
  name    text NOT NULL
  type    enum('person','shared','household')
}

// assets
assets {
  id            uuid PRIMARY KEY
  userId        uuid REFERENCES users(id)
  name          text NOT NULL
  type          enum('bank_account','investment','real_estate','crypto','cash','other')
  value         numeric(15,2)
  currency      text DEFAULT 'INR'
  valuationDate date
}

// liabilities
liabilities {
  id                uuid PRIMARY KEY
  userId            uuid REFERENCES users(id)
  name              text NOT NULL
  type              enum('home_loan','car_loan','credit_card','student_loan','personal_loan','other')
  outstandingAmount numeric(15,2)
  interestRate      numeric(5,2)
  monthlyPayment    numeric(15,2)
  lastUpdated       date
}

// net_worth_snapshots
netWorthSnapshots {
  id               uuid PRIMARY KEY
  userId           uuid REFERENCES users(id)
  snapshotDate     date NOT NULL   -- YYYY-MM-01
  totalAssets      numeric(15,2)
  totalLiabilities numeric(15,2)
  netWorth         numeric(15,2)   -- computed: assets - liabilities
  notes            text
  createdAt        timestamp DEFAULT now()
}
```

---

## 12. Security & Privacy

### 12.1 Privacy by Design

| Principle | Implementation |
|-----------|----------------|
| Data minimization | Session mode stores zero data server-side |
| Explicit consent | Users must actively opt-in to cloud storage |
| Right to export | `/v1/export/*` endpoints always available |
| Right to delete | DELETE /v1/account wipes all user data |
| Data isolation | All queries scoped by `user_id` from JWT |

### 12.2 Encryption

- **In transit**: HTTPS/TLS on all endpoints
- **At rest** (cloud mode):
  - PostgreSQL column-level encryption for sensitive fields using `pgcrypto`
  - File uploads (statements) stored encrypted in Cloudflare R2 with server-side encryption
- **Passwords**: bcrypt with cost factor ≥ 12
- **JWT secrets**: Rotated secrets using environment variables

### 12.3 Authentication Security

- Access tokens expire in 15 minutes
- Refresh tokens are httpOnly cookies (not accessible to JS)
- CSRF protection on all state-changing endpoints
- Rate limiting on auth endpoints (5 req/min)

---

## 13. Deployment Architecture

> **Goal**: One vendor (Railway) for backend + database; Cloudflare Pages for frontend (free). No S3, no separate secrets tool, no extra database vendor.

### 13.1 Environments

| Environment | Frontend | Backend | Database |
|-------------|----------|---------|----------|
| Development | `localhost:3000` | `localhost:3001` | Local PostgreSQL via Docker |
| Staging | Cloudflare Pages (preview branch) | Railway (staging service) | Railway PostgreSQL (staging) |
| Production | Cloudflare Pages | Railway | Railway PostgreSQL |

### 13.2 Deployment Checklist

**Backend (API) — fully standalone:**
- Exposes REST endpoints, no dependency on Next.js
- Deployable as a Docker container to Railway
- Environment variables managed via Railway's built-in env var UI
- Database URL injected by Railway automatically

**Frontend:**
- Deployed to Cloudflare Pages via GitHub integration
- Calls backend via `NEXT_PUBLIC_API_URL` env var
- Can be replaced by a React Native app pointing to the same API URL

### 13.3 Docker (Backend)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## 14. Future Mobile Considerations

### 14.1 Today → Tomorrow

| Concern | Today (Web) | Tomorrow (Mobile) |
|---------|-------------|-------------------|
| UI | Next.js + shadcn | React Native + NativeWind |
| State | Zustand | Same Zustand stores |
| API | Same REST API | Same REST API |
| Local storage | sql.js (OPFS) | react-native-sqlite-storage |
| Parsers | Browser FileReader | Device filesystem access |

### 14.2 Shared Code

The monorepo structure allows:
- `packages/types` → shared between web, mobile, and API
- `packages/rules-engine` → same logic on web and mobile
- `packages/parsers` → reusable on mobile with native file access

### 14.3 Recommended Mobile Path

When ready to go mobile:
1. Scaffold `apps/mobile` with Expo (React Native)
2. Point to same `packages/` shared logic
3. Replace `SQLiteAdapter` with `react-native-sqlite-storage`
4. All API calls require zero changes

---

## Appendix: Open Decisions & Future Considerations

| Decision | Current Call | Notes |
|----------|-------------|-------|
| PDF parsing | Deferred | Excel + CSV only for now |
| ML categorization | Deferred | Rules-based first |
| Recurring detection | Deferred | Out of scope for MVP |
| Google/Apple login | Deferred | Phase 2 |
| Budget tracking | Deferred | Future roadmap |
| Bank API integration | Deferred | Out of scope |
| Subscription detection | Deferred | Future roadmap |

---

*End of Technical Architecture Plan*

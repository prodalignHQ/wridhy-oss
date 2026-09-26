# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install dependencies (from root)
pnpm install

# Start both web (port 3000) and API (port 3001) concurrently
pnpm dev

# Kill zombie processes if ports are occupied
lsof -ti :3000,3001 | xargs kill -9
```

### Database
```bash
# Start local PostgreSQL
docker-compose up -d

# Push Drizzle schema to DB (after schema changes)
# Note: `drizzle-kit push` is interactive (arrow keys) and hangs under pipes —
# use `drizzle-kit generate` then apply drizzle/NNNN_*.sql via
# `docker exec momoney_postgres psql ... -f` (strip `--> statement-breakpoint`).
# For FRESH databases apply 0000→NNNN in order; keep SQL files in sync with
# schema.ts (the committed chain once drifted: owners.notes, assets.metadata).
pnpm --filter @momoney/db exec drizzle-kit generate

# Run database seed
pnpm --filter @momoney/db exec tsx src/seed.ts
```

### Building & Linting
```bash
# Build all packages and apps (hosted/PostgreSQL mode)
pnpm build

# Build single standalone binary (SQLite embedded, zero-setup for non-tech users)
pnpm run build:binary

# Cross-compile standalone binary for macOS, Linux, and Windows
pnpm run build:binary:all

# Type-check all
pnpm type-check

# Lint all
pnpm lint

# Run for a specific app/package only
pnpm --filter @momoney/api lint
pnpm --filter web lint
```

### Running the API in isolation
```bash
# Dev mode (tsx watch)
pnpm --filter @momoney/api dev
```

## Architecture

### Monorepo Structure

Turborepo + pnpm workspaces. Two apps and five packages:

- **`apps/api`** — Hono.js REST API on Node.js (port 3001). Entry point: `src/index.ts`.
- **`apps/web`** — Next.js 16 App Router frontend (port 3000). Uses Tailwind CSS v4 + shadcn/ui.
- **`packages/db`** — Drizzle ORM schema + PostgreSQL client. The single source of truth for all table definitions and relations. Exported as `@momoney/db`.
- **`packages/types`** — Shared Zod schemas and inferred TypeScript types used across `api` and `web`.
- **`packages/parsers`** — Bank statement parsers. Each bank implements `BankParser` (see `base.parser.ts`) and is registered via `parser-registry.ts`. Currently supports ICICI savings (CSV/XLS/PDF) and ICICI credit card.
  - Package builds to `dist/` (`main: ./dist/index.js`); Turbopack cannot resolve TS `.js`-suffix source imports, so web/API must consume `dist`, never `src`.
  - `src/browser.ts` is the browser-safe entry (no `pdf-parse`): `import ... from '@momoney/parsers/browser'`. Server uses the root entry.
  - Browser constraints: named xlsx imports only, `loadXlsxSSF()` for serial dates, no Node-only deps. See `docs/customization/parsers.md`.
- **`packages/rules-engine`** — Pure isomorphic categorization logic. The `categorize()` function applies user rules → system rules → merchant dictionary → default, in that priority order. Builds to `dist/`; consumed as such.
- **`packages/local-engine`** — Local-first core (new): isomorphic dedup (`computeDedupHashBrowser`, SubtleCrypto SHA-256, parity-verified with server), in-memory analytics port of `InsightsService` (`getMonthlyInsightsLocal`, etc.), and the `LocalVault` storage seam (IndexedDB now, SQLCipher/OPFS later). Web entry points: `apps/web/lib/engine/` + `apps/web/workers/parser.worker.ts`.
  - `src/crypto.ts` — vault envelope: Argon2id KEK (hash-wasm) → secretbox-wrapped DEK → XChaCha20-Poly1305 snapshot/file seal (noble). DB `opslimit`/`memlimit` = Argon2 iterations/memory-KiB.
- **On-device OPFS database** — `apps/web/workers/db.worker.ts` (wa-sqlite sync build + `OriginPrivateFileSystemVFS`, dedicated Worker only) with `apps/web/lib/engine/opfs-db.ts` facade. Tables: `local_transactions/statements/categories` (cache of cloud truth). Lock seals `momoney.db` → `momoney.db.sealed` with the vault DEK; unlock unseals. `apps/web/public/wa-sqlite.wasm` is vendored (refresh when upgrading wa-sqlite). Page-level encryption via SQLite3MC custom build is a future drop-in (see research notes in chat history).
  - Phase 3 extended the cache to all reference tables (`local_accounts/owners/transaction_owners/rules/merchants/invoices/invoice_statements/invoice_items`). SQL is shared via `packages/local-engine/src/opfs-schema.ts` (builders verified against node:sqlite) so worker and tests can't drift.
  - **Local-first import** (`lib/engine/import.ts`): parse → same `categorize()` call as the server → SubtleCrypto dedupHash → OPFS, instantly. The same file is then uploaded to the existing `/v1/statements/upload` for backup; rows converge by dedupHash (`deleteTransactionsFromCache` drops superseded local ids on cache refresh). Statements history merges not-yet-synced local imports with an "On-device" badge.
  - **Local invoice analysis** (`local-engine/src/invoices.ts` port + `lib/engine/local-invoices.ts` composer): invoice detail falls back to an OPFS-composed "Offline preview" when the API is unreachable. Invoice edits/generate still go through the server when online — full offline editing is future work.
- **`packages/utils`** — Shared utilities: `cn()` for Tailwind class merging, currency formatters, color assignment, string hashers.

### API (`apps/api`)

All routes live in `src/routes/` and are versioned under `/v1/`. Every route file exports a single `Hono` app instance that is mounted in `src/index.ts`.

**Auth pattern:** All protected routes apply `authMiddleware` from `src/middleware/auth.ts`. This middleware calls Better Auth's `auth.api.getSession()`, verifies email is confirmed, and sets `c.get('userId')` for downstream handlers. Routes always scope queries with `eq(table.userId, userId)` to enforce data isolation.

**Response envelope:** All routes return `{ success: true, data: ... }` on success and `{ success: false, error: { code, message } }` on error. The `apiClient` in the frontend (`apps/web/lib/api.ts`) relies on this shape.

**Statement upload pipeline:** `POST /v1/statements/upload` orchestrates the full ingestion flow:
1. `@momoney/parsers` parses the file buffer into `ParsedTransaction[]`
2. `@momoney/rules-engine`'s `categorize()` auto-assigns a category to each transaction
3. A `dedupHash` (sha256 of `accountId|date|amount|description`) prevents duplicate imports via `onConflictDoNothing`
4. Everything is wrapped in a single DB transaction

**Encrypted vault (local-first sync):** `GET|PUT|DELETE /v1/vault` (`src/routes/vault.ts`) is an *opaque* store — one row per user in `vault_blobs` holding base64 XChaCha20-Poly1305 ciphertext + Argon2/PRF key-wrap metadata. The server never decrypts. Client crypto lives in `@momoney/local-engine/src/crypto.ts` (hash-wasm Argon2id + noble ciphers); WebAuthn PRF in `apps/web/lib/engine/webauthn-prf.ts`; sync orchestration in `vault-sync.ts` + `lib/store/vault.store.ts` (DEK in memory only, wiped on lock). Regression: `apps/api/vault-e2e.mts` (real signup → PUT → GET → client-decrypt → DELETE).

### Frontend (`apps/web`)

**Route groups:**
- `(auth)` — Login/signup pages, no sidebar
- `(app)` — All authenticated pages with sidebar + layout guard. The layout performs a server-side session check and redirects to `/login` if unauthenticated.

**Auth:** `getServerSession()` in `lib/auth.server.ts` fetches the session from the API using forwarded cookies. Client-side auth uses `better-auth`'s client from `lib/auth.client.ts`. The Next.js middleware (`middleware.ts`) does a lightweight cookie presence check for fast redirects.

**API calls:** All client-side data fetching goes through `lib/api.ts`'s `apiClient.fetch()`, which includes credentials and handles the `EMAIL_NOT_VERIFIED` 403 redirect automatically.

**State:** Zustand stores live in `lib/store/`. `transactions.store.ts` manages the transaction list state for the transactions page. `ui.store.ts` manages sidebar collapse state.

**Component structure:** Feature-specific components live under `components/<feature>/` (e.g., `components/transactions/`, `components/statements/`, `components/networth/`). Shared UI primitives (shadcn-based) are in `components/ui/`. Layout components (Sidebar, LayoutWrapper) are in `components/layout/`.

### Database Schema Key Concepts

Schema files in `packages/db/src/`:
- `schema.ts` — PostgreSQL schema (hosted mode).
- `schema.sqlite.ts` — SQLite schema (standalone binary mode).
- `sqlite-init.ts` — SQLite table creation DDL and indexes.

> **CRITICAL RULE**: Whenever adding or altering tables/columns in `schema.ts`, you **must** also update `schema.sqlite.ts` and `sqlite-init.ts` to keep SQLite and PostgreSQL in sync!

Key relationships:

- **`owners`** — People who share finances (e.g., "Self", "Partner"). Transactions can be split between multiple owners via the `transaction_owners` junction table, which tracks each owner's `amount` and `percentage` share.
- **`categories`** — `userId = NULL` means system-level (shared); user-created categories have a `userId`. Supports parent/child hierarchy via `parentId`.
- **`categorizationRules`** — Same NULL-userId pattern for system vs user rules. Priority 1–999 = user, 1000–4999 = system.
- **`invoices`** — A snapshot/report grouping statements and their transactions. Contains `invoiceStatements` (which statements are included) and `invoiceItems` (denormalized transaction snapshots with owner data stored as JSONB).
- **`dedupHash`** on `transactions` — unique constraint preventing duplicate imports.

### Adding a New Bank Parser

1. Create `packages/parsers/src/banks/<bankid>.parser.ts` implementing the `BankParser` interface from `base.parser.ts` (follow the browser-compatibility constraints in `docs/customization/parsers.md`).
2. Register it in `packages/parsers/src/parser-registry.ts` (server) and, if browser-safe (no Node-only deps), in `packages/parsers/src/browser.ts`.
3. Rebuild: `pnpm --filter @momoney/parsers build` (web/API consume `dist/`).

### Adding a New API Route

1. Create `apps/api/src/routes/<name>.ts` exporting a `Hono` instance.
2. Apply `authMiddleware` via `.use('*', authMiddleware)`.
3. Mount it in `apps/api/src/index.ts` under `/v1/<name>`.

### Environment Variables

**`apps/api/.env`:**
```
DATABASE_URL=postgres://momoney:momoney_dev@localhost:5432/momoney_db
BETTER_AUTH_SECRET=your_super_secret_string
```

**`apps/web` (optional, defaults shown):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

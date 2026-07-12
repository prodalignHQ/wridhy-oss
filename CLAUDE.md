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
# Note: interactive — use arrow keys + Enter to confirm, or pipe: yes | <cmd>
pnpm --filter @momoney/db exec drizzle-kit push

# Run database seed
pnpm --filter @momoney/db exec tsx src/seed.ts
```

### Building & Linting
```bash
# Build all packages and apps
pnpm build

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
- **`packages/rules-engine`** — Pure isomorphic categorization logic. The `categorize()` function applies user rules → system rules → merchant dictionary → default, in that priority order.
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

### Frontend (`apps/web`)

**Route groups:**
- `(auth)` — Login/signup pages, no sidebar
- `(app)` — All authenticated pages with sidebar + layout guard. The layout performs a server-side session check and redirects to `/login` if unauthenticated.

**Auth:** `getServerSession()` in `lib/auth.server.ts` fetches the session from the API using forwarded cookies. Client-side auth uses `better-auth`'s client from `lib/auth.client.ts`. The Next.js middleware (`middleware.ts`) does a lightweight cookie presence check for fast redirects.

**API calls:** All client-side data fetching goes through `lib/api.ts`'s `apiClient.fetch()`, which includes credentials and handles the `EMAIL_NOT_VERIFIED` 403 redirect automatically.

**State:** Zustand stores live in `lib/store/`. `transactions.store.ts` manages the transaction list state for the transactions page. `ui.store.ts` manages sidebar collapse state.

**Component structure:** Feature-specific components live under `components/<feature>/` (e.g., `components/transactions/`, `components/statements/`, `components/networth/`). Shared UI primitives (shadcn-based) are in `components/ui/`. Layout components (Sidebar, LayoutWrapper) are in `components/layout/`.

### Database Schema Key Concepts

All tables in `packages/db/src/schema.ts`. Key relationships:

- **`owners`** — People who share finances (e.g., "Self", "Partner"). Transactions can be split between multiple owners via the `transaction_owners` junction table, which tracks each owner's `amount` and `percentage` share.
- **`categories`** — `userId = NULL` means system-level (shared); user-created categories have a `userId`. Supports parent/child hierarchy via `parentId`.
- **`categorizationRules`** — Same NULL-userId pattern for system vs user rules. Priority 1–999 = user, 1000–4999 = system.
- **`invoices`** — A snapshot/report grouping statements and their transactions. Contains `invoiceStatements` (which statements are included) and `invoiceItems` (denormalized transaction snapshots with owner data stored as JSONB).
- **`dedupHash`** on `transactions` — unique constraint preventing duplicate imports.

### Adding a New Bank Parser

1. Create `packages/parsers/src/banks/<bankid>.parser.ts` implementing the `BankParser` interface from `base.parser.ts`.
2. Register it in `packages/parsers/src/parser-registry.ts`.

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

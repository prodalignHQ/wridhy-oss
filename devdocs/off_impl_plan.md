# MoMoney: Browser-First Mode (No Login Required)

## Overview

The goal is to make the entire MoMoney app usable **directly in the browser**, with no account or server required. Login/signup should remain available but be **strictly optional**. All data — accounts, transactions, statements, categories, rules, net worth, etc. — will be stored in `localStorage`. The parsers and rules engine (which already exist as workspace packages) will be run **client-side** in the browser, since they are pure TypeScript with no Node.js-specific dependencies.

The core insight is that there are already stubs for a "local" adapter in `storage-mode.tsx`, and the parsers/rules-engine are already isomorphic — they don't use the DB or any Node-only APIs.

---

## Architecture: Two-Mode System

| | **Local Mode** (default, no login) | **Cloud Mode** (logged in) |
|---|---|---|
| Data storage | `localStorage` | PostgreSQL via API |
| Auth required | ❌ No | ✅ Yes |
| File parsing | Client-side (`@momoney/parsers`) | Server-side (API) |
| Categorization | Client-side (`@momoney/rules-engine`) | Server-side |
| Persistence | Browser only | Cross-device |

---

## Key Design Decisions

> [!IMPORTANT]
> **Login stays fully optional.** The middleware, app layout, and sidebar must NOT redirect unauthenticated users to login. Instead, they should let them in as a "local user."

> [!IMPORTANT]
> **No DB access from the web app.** All localStorage operations happen purely in the browser. The `@momoney/parsers` and `@momoney/rules-engine` packages are already isomorphic — they'll be imported directly by the web app.

> [!WARNING]
> The **statements page** currently posts files to the API for parsing. In local mode, parsing will happen entirely in the **browser** using `@momoney/parsers` directly. This is the most complex part of the change.

---

## Proposed Changes

### 1. Auth / Middleware Layer

#### [MODIFY] middleware.ts
Strip the auth redirect entirely. Middleware will no longer redirect unauthenticated users to `/login`. It will simply pass all requests through.

#### [MODIFY] app/(app)/layout.tsx
Remove the `getServerSession()` call and the redirect to `/login`. The layout will render for **all** users. The `Sidebar` will be adapted to not require a user prop (it renders a "local user" fallback).

---

### 2. Local Storage Engine

#### [NEW] lib/store/local-db.ts
A new `localDb` singleton that wraps all `localStorage` CRUD operations for every entity:
- **Accounts** — `momoney_accounts`
- **Statements** — `momoney_statements`
- **Transactions** — `momoney_transactions`
- **Categories** — `momoney_categories` (seeded with system defaults)
- **Rules** — `momoney_rules`
- **Owners** — `momoney_owners`
- **Net Worth Assets/Liabilities** — `momoney_assets`, `momoney_liabilities`, `momoney_nw_snapshots`

All data will be keyed per-user in cloud mode so switching to cloud doesn't contaminate local data.

#### [MODIFY] lib/store/storage-mode.tsx
Implement the `localAdapter` fully (currently it's a stub returning empty arrays). The local adapter will:
- Call `localDb` for CRUD operations
- Run `@momoney/parsers` client-side for statement parsing
- Run `@momoney/rules-engine` client-side for categorization
- Compute insights (monthly, yearly, category comparisons, averages) from local transactions in-memory

---

### 3. Data Adapter Interface Expansion

The current `DataAdapter` in `storage-mode.tsx` only covers insights queries. It needs to be expanded to cover **all** data operations so every page can go through the adapter.

The extended interface will cover: Accounts CRUD, Statements (preview, import, list, delete), Transactions (paginated list, update category, update owners, bulk ops), Categories CRUD, Owners CRUD, Rules CRUD, Net Worth (assets + liabilities + snapshots), and all existing Insights methods.

---

### 4. Page-by-Page Refactoring

Each page currently calls `apiClient.fetch(...)` directly. They will be updated to call through `useStorageMode().adapter` instead.

#### [MODIFY] Accounts Page
Replace `apiClient.fetch('/v1/accounts')` → `adapter.getAccounts()`, etc.

#### [MODIFY] Statements Page
- Remove the `fetch` to `/v1/statements/preview` — call `adapter.previewStatement(file, bankId)` instead, which in local mode calls the parser directly in the browser.
- Remove the `fetch` to `/v1/statements/upload` — call `adapter.importStatement(...)` which runs the parser + rules engine locally and saves to `localStorage`.
- Load statements via `adapter.getStatements()`.

#### [MODIFY] Transactions Page
Replace all `apiClient.fetch` calls → adapter methods.

#### [MODIFY] Rules Page
Replace `apiClient.fetch('/v1/rules')` → `adapter.getRules()`, etc.

#### [MODIFY] Insights Page
Already uses `adapter.getMonthlyInsights(...)` etc. — the local adapter stubs just need to be implemented.

#### [MODIFY] Networth Page
Replace `apiClient.fetch('/v1/networth/...')` → `adapter.getAssets()`, `adapter.getLiabilities()`, etc.

#### [MODIFY] Owners/Household Page
Replace `apiClient.fetch('/v1/owners')` → `adapter.getOwners()`, etc.

---

### 5. Sidebar & Layout Adaptations

#### [MODIFY] components/layout/Sidebar.tsx
- Make `user` prop optional.
- When no user (local mode): show "Local User" avatar, no email.
- Remove `emailVerified` gating of nav items — in local mode all nav items are enabled.
- Change "Logout" button: in local mode, show "Sign In" that links to `/login`; in cloud mode, show "Logout" as before.
- Add a subtle "Connect Account" CTA in the sidebar footer for local mode users.

#### [MODIFY] components/auth/AppAccessGuard.tsx
In local mode (no emailVerified context), simply render children without blocking.

#### [MODIFY] components/auth/DashboardVerificationNotice.tsx
Only show if the user is actually logged in with an un-verified email.

---

### 6. Auth Store Adaptation

#### [MODIFY] lib/store/auth.store.ts
The `StorageModeProvider` will:
- Default to `"local"` mode when no session.
- Only switch to `"cloud"` mode when a user session is detected.

---

### 7. Default System Categories (Seed Data)

#### [NEW] lib/store/default-categories.ts
The system categories (Food, Travel, Shopping, etc.) currently live only in the DB. For local mode, we need a static TS seed file to pre-populate `localStorage` on first use.

---

### 8. Landing Page Update

#### [MODIFY] app/page.tsx
Add a secondary "Sign in" button alongside "Open Dashboard", with a note clarifying that no login is needed.

---

## Open Questions

> [!IMPORTANT]
> **PDF parsing in the browser**: The `icici-savings-pdf.parser.ts` uses `pdf-parse` which has Node.js Buffer dependencies. This may not work client-side. Options:
> - **a)** Exclude PDF support in local mode (show "PDF requires an account")
> - **b)** Replace `pdf-parse` with `pdfjs-dist` (browser-compatible)
>
> **Which do you prefer?** (Recommendation: start with (a) to keep scope focused)

> [!IMPORTANT]
> **Data portability**: Should local users be able to export/import their data as a JSON backup? Nice-to-have, easy to add. Shall I include it in scope?

> [!IMPORTANT]
> **Local→Cloud migration**: When a local user signs up/logs in, should we offer to migrate their local data to their cloud account? This is out of scope for now but worth knowing your preference.

---

## Verification Plan

### Automated
- TypeScript compile check: `pnpm --filter web build` (no type errors)

### Manual
1. Open `/dashboard` in a fresh incognito window → verify no redirect to login
2. Create an account in local mode → appears in accounts list
3. Upload an ICICI savings XLS statement → parses and imports locally
4. Navigate to `/transactions` → shows imported transactions
5. Assign a category → persists across page refresh
6. Navigate to `/insights` → non-zero data if transactions exist
7. Click "Sign in" → can still log in with cloud mode
8. After cloud login → verify storage mode switches to "cloud" and cloud data loads

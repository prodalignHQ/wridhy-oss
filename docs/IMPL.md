# MoMoney — Implementation Plan

**Version:** v1.1  
**Status:** Active  
**Last Updated:** March 2026  
**References:** [`TECH_PLAN.md`](./TECH_PLAN.md)

---

## Overview

This document breaks the MoMoney technical plan into **6 sequential phases**, each with:
- A clear goal
- Parallel frontend + backend deliverables
- Detailed **frontend design notes** (since there are no visual mockups)
- A demo checkpoint — something you can actually click/see by end of phase

**Owner splitting is a core feature**, not optional. Every transaction can be assigned to one or more owners (people in a household) and split equally between them. This is wired in from Phase 1 and deepens in later phases.

Every phase assumes the LLM starts with the output of the previous phase committed.
The repo starts from zero — Phase 0 bootstraps everything.

---

## Quick Reference: Phase Map

| Phase | Name | Key Milestone |
|-------|------|---------------|
| 0 | Monorepo Bootstrap | Dev environment running end-to-end |
| 1 | Auth, Accounts & Owners | Sign up, log in, create accounts, define household members |
| 2 | Statement Upload, Month Tagging & Owner Assignment | Upload CSV → see transactions with owner assignment and tagged months |
| 3 | Categorization & Rules Engine | Transactions auto-categorized |
| 4 | Invoices, Dashboard & Insights | Draft/generate invoices + monthly spend charts, filterable by owner |
| 5 | Net Worth Tracker | Track assets & liabilities over time |
| 6 | Data Portability & Storage Modes | Export/import, local SQLite mode |

---

## Design System (Applies to All Phases)

Since there are no mockups, the LLM should establish and maintain a consistent design language from Phase 0 onward. **Do not deviate from this between phases.**

### Visual Language
- **Theme:** Dark mode by default, with a toggle for light mode. Background: `zinc-950`, surface cards: `zinc-900`, borders: `zinc-800`.
- **Accent color:** A single violet/indigo accent (`indigo-500`) for primary actions. Use sparingly — one accent per screen.
- **Typography:** Inter font (Google Fonts). Headings in `font-semibold`, labels in `text-xs uppercase tracking-wide text-zinc-400`, values in `font-mono` for currency.
- **Currency display:** Always right-align. Debits in red (`rose-400`), credits in green (`emerald-400`). Use INR formatting (`₹1,23,456`).
- **Spacing:** 8px base unit. Content max-width: `1280px` centered.
- **Rounded corners:** `rounded-xl` on cards, `rounded-lg` on inputs, `rounded-md` on buttons.

### Layout
- **Shell:** Fixed left sidebar (240px wide), scrollable main content area.
- **Sidebar:** Logo at top, nav items with icon + label. Active state: `bg-zinc-800` + `text-white`. Inactive: `text-zinc-400`. Bottom of sidebar: User avatar + name + logout.
- **Page header:** Every page has a fixed header row: `<h1>` page title on the left + primary action button on the right.
- **Empty states:** Every list/table must have a well-designed empty state — centered icon, heading, subtext, and a CTA button. Never show a blank white box.

### Components (build once, reuse everywhere)
- `<StatCard>` — a card with a label, large value, and optional trend badge. Used on Dashboard and Net Worth.
- `<DataTable>` — a shadcn Table wrapper with sorting, pagination, and a filter bar slot.
- `<ConfirmDialog>` — a modal for destructive actions with a red confirm button and cancel. Used anywhere something is deleted.
- `<AmountBadge>` — inline pill that shows an amount colored red (debit) or green (credit).
- `<OwnerAvatars>` — a stacked set of small colored initials-circles representing assigned owners. Used in every transaction row.
- `<CategoryBadge>` — a pill with the category's color dot and name.

### Modals
- Use shadcn `<Dialog>` for all modals. Every modal has: title, optional description, form body, cancel + confirm buttons.
- Confirm button uses the primary action color. Destructive modals use `variant="destructive"`.
- Forms inside modals use `react-hook-form` + `zod`. Show inline field errors, not toast errors.

### Toasts
- Use shadcn `<Sonner>` for all toast notifications. Success toasts green, error toasts red, info toasts neutral.
- Toasts for async success only (e.g., "Saved", "Imported 124 transactions"). Errors on forms go inline.

---

## Phase 0 — Monorepo Bootstrap ✅

> **Goal:** Get a running dev environment with Turborepo, a "hello world" API, and a Next.js shell. No features, but every tool in the stack is wired up correctly and the design system is established.

### Backend Deliverable

1. **Initialize monorepo** with Turborepo
   ```
   momoney/
   ├── apps/api/        ← Hono.js server
   ├── apps/web/        ← Next.js 14 (App Router)
   ├── packages/db/     ← Drizzle schema + migrations
   ├── packages/types/  ← Shared Zod schemas + TS types
   └── packages/utils/  ← Shared helpers
   ```
   > See TECH_PLAN §3.1 for the full directory structure.

2. **`apps/api`** — Hono.js entry point
   - `GET /health` returns `{ status: "ok", version: "0.1.0" }`
   - CORS middleware configured (allow `localhost:3000`)
   - Typed route structure in place (even if routes return 501)
   - Port: `3001`

3. **`packages/db`**
   - Drizzle ORM configured for **PostgreSQL** (cloud) and **SQLite** (local/test)
   - Define **all** core tables upfront (see TECH_PLAN §11.1) — this prevents future migrations from being breaking:
     `users`, `financial_accounts`, `statements`, `transactions`, `transaction_owners`, `invoices`, `invoice_statements`, `invoice_transaction_snapshots`, `categories`, `merchants`, `categorization_rules`, `owners`, `assets`, `liabilities`, `net_worth_snapshots`
   - Run `drizzle-kit generate` and `drizzle-kit push` for initial migration
   - Local dev: **Docker Compose** with a PostgreSQL container on port `5432`

4. **`packages/types`**
   - Zod schemas for all shared types: `Transaction`, `TransactionOwner`, `Owner`, `Account`, `Category`, `Rule`, `NetWorthSnapshot`
   - TypeScript interfaces exported (inferred from Zod)

### Frontend Deliverable

1. **Next.js 14 App Router shell** — `apps/web/`
   - Install: `shadcn/ui`, Tailwind CSS, `zustand`, `react-hook-form`, `zod`, `date-fns`, `recharts`, `sonner`
   - Add Inter font via `next/font/google`
   - Build the full **sidebar shell** with all nav items present (pages render "Coming soon" placeholders):
     - Dashboard, Transactions, Statements, Invoices, Insights, Net Worth, Accounts, Rules, Settings
   - Each nav item has a relevant Lucide icon
   - Bottom of sidebar: placeholder user avatar + "Account" label
   - Build the `<StatCard>`, `<ConfirmDialog>`, `<AmountBadge>`, `<OwnerAvatars>`, `<CategoryBadge>` components now, in a `components/ui/custom/` folder, so every phase can use them consistently

2. **Typed API client**
   - `lib/api.ts` — a typed `fetch` wrapper that reads `NEXT_PUBLIC_API_URL`
   - Handles JSON parsing, error envelope unwrapping, and throws typed errors

3. **`StorageModeContext`** stub
   - Context created at app root (see TECH_PLAN §6.2)
   - Mode hardcoded to `'session'` for now; `adapter` returns empty arrays

### Frontend Design Notes

- **Sidebar:** Left-fixed, `240px`. Logo (`MoMoney` wordmark + small coin icon) at top with `16px` padding. Nav items are `40px` tall with `12px` horizontal padding and `8px` vertical gap. Group nav items with a `Finances` and `Tools` section label in `text-xs uppercase text-zinc-500`.
- **Placeholder pages:** Show a centered illustration (simple SVG or emoji) + heading + subtext. E.g., "Dashboard is coming soon. Import transactions to get started."
- **Install shadcn components:** `button`, `input`, `label`, `dialog`, `select`, `dropdown-menu`, `table`, `badge`, `avatar`, `separator`, `tooltip`, `sheet`, `tabs`, `card`. Do this upfront so they are available in all later phases.

### Demo Checkpoint ✅
- `turbo dev` starts both apps concurrently
- `localhost:3000` — sidebar shell visible, dark theme, all nav links render placeholder pages
- `localhost:3001/health` → `{ status: "ok" }`

---

## Phase 1 — Auth, Accounts & Owners ✅

> **Goal:** A user can sign up, log in, create their first bank account, and define the members of their household (owners). Owners are the foundation for transaction splitting in Phase 2+.

### Backend Deliverable

1. **Auth routes** — `apps/api/src/routes/auth.ts`
   Using **Better Auth** (see TECH_PLAN §5.2):
   - `POST /v1/auth/signup` — bcrypt (cost ≥12), insert `users` row, return access token
   - `POST /v1/auth/login` — validate password, issue JWT (15min) + httpOnly refresh token (30d)
   - `POST /v1/auth/logout` — invalidate session
   - `POST /v1/auth/refresh` — rotate access token

2. **Auth middleware** — `apps/api/src/middleware/auth.ts`
   - Validates JWT on all protected routes
   - Injects `req.userId` from token claims
   - Returns `401 UNAUTHORIZED` in standard error envelope

3. **Accounts routes** — `apps/api/src/routes/accounts.ts`
   - `GET  /v1/accounts` — return the authed user's accounts
   - `POST /v1/accounts` — create account (`accountName`, `accountType`, `bankId`, `currency`)
   - `PATCH /v1/accounts/:id`
   - `DELETE /v1/accounts/:id` — soft-delete
   - All queries scoped by `userId` from JWT (see TECH_PLAN §5.3)

4. **Owners routes** — `apps/api/src/routes/owners.ts`
   Owners represent people in a household. Every user starts with a default "Self" owner auto-created on signup.
   - `GET  /v1/owners` — list owners for the authenticated user
   - `POST /v1/owners` — create owner (`name`, `type`: `person | shared | household`)
   - `PATCH /v1/owners/:id` — rename
   - `DELETE /v1/owners/:id` — delete; re-assign orphaned `transaction_owners` rows to "Self"

5. **System categories seed**
   - On first migration: seed `categories` with `userId = NULL` (system-level):
     Food & Dining, Transport, Shopping, Entertainment, Utilities, Health, Travel, Income, Transfers, Subscriptions, Uncategorized

### Frontend Deliverable

1. **Auth pages**
   - `app/(auth)/login/page.tsx` — email + password form
   - `app/(auth)/signup/page.tsx` — name, email, password form
   - `middleware.ts` — redirect unauthenticated users from `(app)/*` to `/login`

2. **Auth state in Zustand** — `lib/store/auth.store.ts`
   - `{ user, token, login(), logout() }`
   - Access token persisted in `localStorage`; refresh token is httpOnly cookie (handled by browser)

3. **Accounts page** — `app/(app)/accounts/page.tsx`
   - Lists accounts in a card grid (not a table — cards are more scannable for a short list)
   - Each card: bank logo placeholder (colored initials circle) + account name + type badge + currency
   - "Add Account" button (top right) → opens `<Dialog>` modal

4. **Owners page** — `app/(app)/settings/owners/page.tsx` *(nested under Settings)*
   - Section heading: "Household Members"
   - Cards for each owner, each with: colored avatar circle (auto-color from name hash), name, type badge
   - "Self" owner shown first and cannot be deleted (show a lock icon, tooltip: "This is you")
   - "Add Person" button → modal with name input and type selector
   - **Color assignment:** When creating an owner, auto-assign a unique color from a fixed palette: `[indigo, emerald, rose, amber, sky, violet]`. This color is used in `<OwnerAvatars>` throughout the app.

### Frontend Design Notes

- **Auth pages:** Full-screen centered card layout (not the sidebar shell). Background: subtle grid or noise texture on `zinc-950`. Card: `zinc-900`, `rounded-2xl`, `p-8`, `max-w-sm`. Logo above the card. Form submit button is full-width primary.
- **Accounts page:** Use a 3-column responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Each card is `rounded-xl bg-zinc-900 border border-zinc-800 p-5`. Account type shown as a small badge (`bank`, `credit card`, `wallet`, `investment`). Empty state: piggy bank icon + "Add your first account to get started".
- **Owners page:** Render within the Settings layout (a two-column settings layout: sidebar of setting sections on the left, content on the right). Owners are shown as a horizontal list of avatar cards. The avatar circle is `w-10 h-10` with initials, colored per the palette. Max 6 owners recommended (soft limit, warn user).

### Demo Checkpoint ✅
- Sign up → "Self" owner auto-created, redirected to dashboard (empty state)
- Log in → persists across refresh
- Create accounts: "HDFC Savings" (bank), "ICICI Credit Card" (credit_card)
- Settings → add household member "Priya" (person) → her avatar appears in indigo
- Visiting `/dashboard` without auth → redirected to `/login`

---

## Phase 2 — Statement Upload, Month Tagging & Owner Assignment ✅

> **Goal:** The core value prop. Upload a real CSV from your bank, tag the statement to a month, and see your transactions appear in a table. Every transaction can immediately be assigned to one or more owners and split equally between them. Month tagging is the foundation for invoice creation in Phase 4.

### Backend Deliverable

1. **`packages/parsers`** — Bank parser library
   - `base.parser.ts` — abstract `BankParser` interface (see TECH_PLAN §7.2)
   - `parser-registry.ts` — maps `bankId → BankParser`
   - Implement for 2 banks initially:
     - `banks/hdfc.parser.ts` — HDFC savings account CSV
     - `banks/icici.parser.ts` — ICICI bank CSV
   - Each parser returns `ParsedTransaction[]` from an `ArrayBuffer`

2. **Statement upload route** — `apps/api/src/routes/statements.ts`
   - `POST /v1/statements/upload` — `multipart/form-data`: `file`, `bankId`, `accountId`, `statementMonth`
   - Multer in-memory only; file buffer discarded after parse (see TECH_PLAN §7.4)
   - Dedup: `dedupHash = hash(accountId + date + amount + descriptionHash)`
   - On insert: for each new transaction, auto-create a `transaction_owners` row assigning it 100% to "Self"
   - Persist the user-selected `statementMonth` (`YYYY-MM-01`) on every statement record
   - Returns `{ statementId, parsedCount, importedCount, duplicatesSkipped }`
   - `GET  /v1/statements` — list import history, including tagged month
   - `DELETE /v1/statements/:id` — delete statement + all its transactions + their `transaction_owners` rows

3. **Transactions routes** — `apps/api/src/routes/transactions.ts`
   - `GET /v1/transactions` — query params: `accountId`, `startDate`, `endDate`, `categoryId`, `ownerId`, `search`, `page`, `limit`
     - When `ownerId` is provided, join `transaction_owners` and filter; the `amount` in the row for that owner reflects their share
   - `PATCH /v1/transactions/:id` — update `comment`, `categoryId`
   - `GET /v1/transactions/export` — CSV export of filtered transactions

4. **Owner splitting route** — `apps/api/src/routes/transactions.ts` (extend)
   - `PUT /v1/transactions/:id/owners` — replace the owner assignment for a transaction
     - Request body: `{ ownerIds: string[] }` — list of owner IDs to split between
     - Business rule: split **equally** — each owner gets `amount / ownerIds.length`
     - Replaces all existing `transaction_owners` rows for this transaction
     - Response: the updated transaction with `owners` populated

   **Example:**
   ```json
   PUT /v1/transactions/txn_abc/owners
   { "ownerIds": ["owner_self", "owner_priya"] }
   
   → Each owner gets 50% of the transaction amount
   ```

### Frontend Deliverable

1. **Client-side parsers** (session mode)
   - `lib/parsers/` — same `BankParser` interface, using browser `FileReader`
   - Session mode: no server call; parsed transactions go into Zustand

2. **Session-mode data adapter**
   - `lib/adapters/session.adapter.ts` implements `DataAdapter`
   - On import: auto-assigns "Self" as the sole owner of every transaction

3. **Statements page** — `app/(app)/statements/page.tsx`
   - File upload dropzone (dashed border, `rounded-xl`, drag-and-drop + click to browse)
   - Bank selector + account selector (dropdowns)
   - After parsing: preview table of first 20 rows (Date, Description, Amount, Type)
   - Month picker after preview: user must tag the statement to a month before import
   - Preview table shows a "Ready to import" badge count
   - "Confirm Import" button → shows loading state → success toast "Imported 124 transactions"
   - Statement history grouped by tagged month
   - Each month group includes a "Create Invoice" CTA that deep-links to the Invoices page with that month pre-selected

4. **Transactions page** — `app/(app)/transactions/page.tsx`

   **Table columns:** Date | Description | Category | Owners | Amount | Actions

   **Filters (top of page, horizontal row):**
   - Search input (searches description)
   - Date range picker (start + end)
   - Category filter (multi-select dropdown)
   - Owner filter (multi-select dropdown — each owner shown with their color avatar)
   - Account filter

   **Owner column:**
   - Displays `<OwnerAvatars>` — a stacked set of small colored circles, one per owner
   - If 1 owner: show their avatar. If 2+: show stacked avatars with a "+N" overflow
   - Clicking the owner column cell opens the **Split Owner Modal**

   **Split Owner Modal** (opened per-transaction):
   - Title: "Assign Owners — [Transaction Description]"
   - Shows transaction amount: e.g., `₹1,200 · Swiggy · 12 Mar`
   - Checklist of all household owners, each with a checkbox and their colored avatar
   - When multiple owners are checked: show "Split equally — ₹600 each" below the list
   - Confirm button: "Save" → calls `PUT /v1/transactions/:id/owners`
   - This is the **only** splitting model — always equal. No manual percentage entry.

   **Inline category edit:**
   - Clicking a category cell opens a searchable dropdown using shadcn `<Popover>` + `<Command>`
   - Categories grouped by system vs. user-defined

### Frontend Design Notes

- **Statements page dropzone:** Large centered dropzone, `border-2 border-dashed border-zinc-700 rounded-xl p-12`. Icon: upload cloud SVG. Text: "Drop your bank statement here" with subtext "Supports CSV and Excel from HDFC, ICICI, and more". On drag-over: border turns `indigo-500`.
- **Preview table:** Shown below dropzone in a collapsible section. Max 20 rows. Debit amounts in `rose-400`, credit in `emerald-400`. Table has a "20 of 124 rows shown" footer.
- **Transactions table:** Use `<DataTable>` component built in Phase 0. Rows are `44px` tall. Hovering a row shows a faint `bg-zinc-800` highlight. The `Amount` column is right-aligned, `font-mono`. The `Actions` column shows a `•••` button that opens a dropdown: "Assign Owners", "Edit Comment", "Delete".
- **Split Owner Modal:** Owner checkboxes should be styled as large clickable rows (not just small checkboxes) — full-width, `48px` tall, avatar on left, name in middle, checkbox on right. Checked state: `bg-indigo-950 border border-indigo-700`. The equal split summary line should be prominently styled in `text-sm font-semibold text-emerald-400`.
- **Owner filter in filters bar:** Each owner shown as a mini avatar with name. Selected owners get an active highlight ring.

### Demo Checkpoint ✅
- Session mode: upload HDFC CSV → transactions appear in table, "Self" assigned as default owner
- Cloud mode: transactions persist across refresh
- Open any transaction → "Assign Owners" → check "Self" + "Priya" → shows "₹600 each" → Save
- Owner avatars update in the row immediately
- Filter by owner "Priya" → only see transactions shared with Priya
- Re-upload same file → `duplicatesSkipped` shown, no duplication

---

## Phase 3 — Categorization & Rules Engine ✅

> **Goal:** Transactions are auto-categorized on import using a priority-based rules engine. Users can create and preview custom rules. Categories are fully manageable.

### Backend Deliverable

1. **`packages/rules-engine`** — shared categorization logic
   - `categorize(txn, rules): categoryId` function (see TECH_PLAN §8.4)
   - Priority: User rules (1–999) → System rules (1000–4999) → Merchant dict (5000) → Default (9999)
   - Match types: `contains`, `equals`, `regex`, `gt`, `lt` on `merchant`, `description`, `amount`
   - `normalizeMerchant(rawDescription): MerchantRecord | null` — runs before categorization

2. **Integrate rules engine into statement upload**
   - After parsing, call `categorize()` on each transaction before DB insert
   - Wire into `apps/api/src/services/categorization.service.ts`

3. **Categories routes** — `apps/api/src/routes/categories.ts`
   - `GET  /v1/categories` — system + user categories
   - `POST /v1/categories` — create user category (`name`, `icon`, `color`, `parentId`)
   - `PATCH /v1/categories/:id` — update (user only)
   - `DELETE /v1/categories/:id` — delete; reassign transactions to Uncategorized

4. **Rules routes** — `apps/api/src/routes/rules.ts`
   - `GET  /v1/rules` — system + user rules
   - `POST /v1/rules` — create user rule
   - `PATCH /v1/rules/:id` — update
   - `DELETE /v1/rules/:id` — delete
   - `POST /v1/rules/preview` — return count + sample of matching transactions for a given rule definition
   - System rules: 403 on any mutation attempt

5. **Merchants routes** — `apps/api/src/routes/merchants.ts`
   - `GET/POST/PATCH/DELETE /v1/merchants`
   - User merchant records override system ones (see TECH_PLAN §8.3)

6. **Seed data**
   - System rules: `SWIGGY*` → Food, `UBER*` → Transport, `AMAZON` → Shopping, `ATM WDL` → Cash, `SALARY` → Income, `ZOMATO` → Food, `NETFLIX` → Subscriptions, `SPOTIFY` → Subscriptions
   - System merchant normalizations

### Frontend Deliverable

1. **Rules page** — `app/(app)/rules/page.tsx`

   **Two-tab layout:** "My Rules" | "System Rules"

   **My Rules tab:**
   - Rules shown as a sortable list (ordered by priority number, low = first)
   - Each row: priority badge | match field | match type | match value | → | category badge | active toggle | edit | delete
   - "New Rule" button (top right) → opens rule builder modal
   - "Re-apply all rules" button → batch recategorization with confirmation dialog

   **Rule Builder Modal:**
   - Step 1 — Match: field selector (tabs: "Description" / "Merchant" / "Amount"), match type selector, match value input
   - Step 2 — Assign: category picker (searchable dropdown with color dots)
   - Live preview panel: shows "X transactions would match" count, and 3 sample matching transactions listed below (fetched from `POST /v1/rules/preview` on debounce)
   - "Save Rule" button

   **System Rules tab:**
   - Same display as My Rules but all rows are grayed out with a lock icon; no edit/delete actions
   - Subtext at top: "System rules are maintained by MoMoney. Create a My Rule with a lower priority number to override them."

2. **Categories section** — rendered as a second section below the Rules tabs (same page)
   - Grid of category pills: color dot + name + transaction count
   - User categories have an edit pencil icon
   - "Add Category" button → modal with `name`, emoji/icon picker (a grid of preset emojis), color picker (8 swatches)
   - System categories shown in a separate "System Categories" section — read-only

3. **Re-apply rules** on Transactions page
   - "Re-apply Rules" button in the table filter bar
   - Confirmation dialog: "This will recategorize all transactions that don't have a manual override. Continue?"
   - After: toast "Updated 47 transactions"

4. **Client-side rules engine** (session mode)
   - `packages/rules-engine` imported in the browser
   - Applied automatically at import time in session mode

### Frontend Design Notes

- **Rules list:** Each rule row is `48px` tall with horizontal padding. Priority badge is a small `rounded-full bg-zinc-800 text-xs font-mono w-8 text-center` pill. Match value shown in a `font-mono text-sm` span. The arrow `→` separator is `text-zinc-500`. Category badge uses that category's color as a left border dot.
- **Rule Builder Modal:** Two-pane layout inside the modal — left: the rule form; right: a live preview box (`bg-zinc-950 rounded-lg p-4`). Preview box shows a loading skeleton while fetching, then "12 matching transactions" in bold + 3 small transaction rows (date, description, amount). If no matches: "No transactions match yet" with a magnifying glass icon.
- **Active toggle:** Use shadcn `<Switch>` component. Inactive rules have a muted row with `opacity-50`.
- **Categories grid:** Pills are `rounded-full px-3 py-1.5 text-sm` with a colored `w-2 h-2 rounded-full` dot inline. User categories show a subtle pencil icon on hover.
- **Color picker in Add Category modal:** 8 color swatches in a `grid-cols-4 gap-2`. Each swatch is `w-6 h-6 rounded-full cursor-pointer`. Selected swatch has a white ring.

### Demo Checkpoint ✅
- Upload CSV → Swiggy → Food, Uber → Transport auto-applied
- Create rule "description contains NETFLIX → Subscriptions" → preview shows matching count → save → re-apply → Netflix recategorized
- System rules tab visible but locked
- Create a custom category "Gym & Fitness" with a green color

---

## Phase 4 — Invoices, Dashboard & Insights ✅

> **Goal:** Turn categorized, owner-attributed transaction data into saved monthly invoices and meaningful visualizations. Users can draft an invoice from tagged statements, generate it into a frozen snapshot with analysis, and still use the broader dashboard/insights views for trends over time.

### Backend Deliverable

1. **Invoice routes** — `apps/api/src/routes/invoices.ts`
   (See TECH_PLAN §10.10)
   - `GET /v1/invoices` — return two buckets: `drafts[]` and `generated[]`
   - `POST /v1/invoices` — create a draft from `{ name, invoiceMonth, statementIds[] }`
   - `GET /v1/invoices/:id` — return invoice metadata, selected statements, transaction rows, and analysis
   - `PATCH /v1/invoices/:id` — rename a draft and/or update selected statements
   - `POST /v1/invoices/:id/generate` — create snapshot rows and mark the invoice as generated
   - Validation rule: all selected statements must share the same tagged `invoiceMonth`
   - Generation rule: snapshot current category + owner split state for every included transaction

2. **`apps/api/src/services/invoices.service.ts`**
   - `createDraft(userId, invoiceMonth, statementIds, name?)`
   - `loadInvoice(userId, invoiceId)` — returns live rows for drafts, frozen snapshot rows for generated invoices
   - `generateInvoice(userId, invoiceId)` — writes `invoice_transaction_snapshots`
   - `computeInvoiceAnalysis(invoiceId)` — returns:
     - spend by owner
     - spend by owner within each category
   - Invoice analysis uses **debit transactions only** and respects owner split amounts

3. **Insights routes** — `apps/api/src/routes/insights.ts`
   (See TECH_PLAN §10.11)
   - `GET /v1/insights/monthly?month=2025-03&accountIds=&ownerIds=`
     - When `ownerIds` is provided: join `transaction_owners` and sum only the share amounts for those owners
     - Returns: `{ totalSpend, totalIncome, netFlow, topCategories[], topMerchants[], uncategorizedCount }`
   - `GET /v1/insights/yearly?year=2025&ownerIds=`
     - Month-by-month spend + income (12 data points)
   - `GET /v1/insights/categories?startDate=&endDate=&ownerIds=`
     - Spend per category with percentage of total
   - `GET /v1/insights/merchants?startDate=&endDate=&ownerIds=&limit=10`
     - Top merchants by spend amount

4. **`apps/api/src/services/insights.service.ts`**
   - All aggregations via SQL GROUP BY — no N+1 queries
   - Owner filtering: `JOIN transaction_owners ON transaction_owners.transaction_id = transactions.id WHERE transaction_owners.owner_id IN (?)`

### Frontend Deliverable

1. **Invoices page** — `app/(app)/invoices/page.tsx`

   **Create Draft panel:**
   - Month selector seeded from uploaded statement months
   - Statement checklist for the selected month (multi-select across accounts/banks)
   - Invoice name input
   - "Create Draft" button

   **Draft workspace:**
   - Visible once a draft is selected or created
   - Header row: invoice name, selected month, statement chips, "Save Draft", "Generate Invoice"
   - Transaction table sourced from the draft's selected statements
   - Filters: Description search, Category filter, Amount type filter (`All | Debit | Credit`)
   - Inline category editing reuses the transaction category picker
   - Owner assignment reuses the split-owner modal

   **Invoice index rail / section:**
   - Drafts section lists all ungenerated invoices
   - Generated section lists all finalized invoices
   - Clicking any item loads it into the main detail panel

   **Generated invoice detail:**
   - Read-only transaction snapshot table
   - Analysis section with:
     - "Who spent how much?"
     - "Who spent how much in each category?"

2. **Dashboard page** — `app/(app)/dashboard/page.tsx`

   **Top bar:**
   - Month selector (prev/next arrows + "March 2026" label, `rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2`)
   - Owner filter (right of month selector): multi-select of owner avatars. Default: "All". Selecting specific owners filters all charts.

   **KPI row (4 stat cards using `<StatCard>`):**
   - Total Spend this month (large, red tint)
   - Total Income this month (large, green tint)
   - Net Flow: income − spend (green if positive, red if negative)
   - Uncategorized: count as a warning badge + link "Fix now →" to Transactions page filtered by Uncategorized

   **Second row — two charts side by side:**
   - Left (60% width): **Daily spend bar chart** — bars per day of selected month. X-axis: day numbers. Y-axis: INR. Bars colored `indigo-500`. Hover tooltip shows day + total.
   - Right (40% width): **Category donut chart** — each slice is that category's color. Center label shows total spend. Legend below lists top 5 categories with name + amount + percentage.

   **Third row — full width:**
   - **Top merchants table** — not a chart. A simple ranked list: rank | merchant name | total spend | transaction count. Shows top 8. "View all in Insights →" link.

3. **Insights page** — `app/(app)/insights/page.tsx`
   - Owner filter + date range filter at the top (same pattern as Dashboard)
   
   **Section 1 — Year Overview:**
   - Year selector (current year default)
   - Grouped bar chart: each month has two bars — Spend (rose) and Income (emerald)
   - Below chart: year totals summary row

   **Section 2 — Category Trends:**
   - Stacked area chart: X-axis months, Y-axis total spend, each area is a category color
   - Legend below (only top 6 categories to keep readable)

   **Section 3 — Top Merchants:**
   - Horizontal bar chart: top 10 merchants by spend for the selected date range
   - Each bar labeled with merchant name and total

4. **Client-side insights** (session mode)
   - `lib/adapters/session.adapter.ts` implements `getInsights()` using `Array.reduce()`
   - Owner filtering applied in-memory

### Frontend Design Notes

- **Invoices page layout:** Two-pane layout on desktop — left rail for Drafts/Generated lists, right workspace for the selected invoice. On mobile, the list collapses into stacked sections above the workspace.
- **Create Draft panel:** `bg-zinc-900 border border-zinc-800 rounded-2xl p-6`. Statement chips show bank/account names; selected chips get an `indigo-500` ring. The month selector and name input sit on the same row on desktop.
- **Draft transaction table:** Reuse the Transactions visual language so the user is editing familiar controls. Above the table, show compact summary cards for Total Spend, Total Income, and statement count. Filter bar matches the Transactions page but is scoped to the active draft.
- **Generated analysis section:** Two cards stacked vertically. First card is owner totals (`Owner | Spend | % of invoice spend`). Second card is a grouped table where each owner expands into their category totals. Spend numbers are debit-only and `font-mono`.
- **Dashboard layout:** Three distinct horizontal sections with `gap-6` between them. Do not use a masonry/mosaic layout — keep it top-to-bottom, predictable.
- **StatCard design:** `bg-zinc-900 border border-zinc-800 rounded-xl p-5`. Label in `text-xs font-medium uppercase tracking-wide text-zinc-400`. Value in `text-3xl font-bold font-mono`. Optional sub-label (e.g., "vs last month +12%") in `text-sm text-zinc-500`. Spend card: value in `rose-400`. Income card: value in `emerald-400`. Net flow: dynamic color. Uncategorized: value in `amber-400` with a warning triangle icon.
- **Charts:** All charts via `recharts`. Custom tooltip: `bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm`. Grid lines: `stroke="#3f3f46"` (zinc-700). Axis labels `text-xs text-zinc-500`. No chart title inside the chart — use a heading above the chart component instead.
- **Donut chart center label:** Use `recharts` `customized` label to render a centered `<text>` element inside the donut showing "₹X total". This is a small implementation detail but makes the chart feel premium.
- **Insights page sections:** Each section in a `bg-zinc-900 border border-zinc-800 rounded-xl p-6` container. Section heading: `text-base font-semibold mb-4`.
- **Owner filter UI (both pages):** Render as a row of small avatar pills in `rounded-full`. Unselected: `bg-zinc-800 text-zinc-400`. Selected: `ring-2 ring-indigo-500 bg-zinc-700`. Clicking toggles selection. "All" is a separate pill that deselects all others.

### Demo Checkpoint ✅
- Statements imported for March 2026 from 2 accounts → Statements page shows them grouped under March with a "Create Invoice" CTA
- Invoices page → create "March Household Invoice" draft from those statements
- Filter invoice transactions by description/category/debit-credit, update categories, reassign owners, save draft
- Generate invoice → it moves from Drafts to Generated
- Open generated invoice → analysis shows owner totals and owner-by-category totals
- Import 3 months of data → dashboard shows correct spend/income/net flow
- Owner filter: select "Priya" only → charts update to show only Priya's share
- Uncategorized count shows a warning; clicking "Fix now" navigates to filtered transactions
- Insights: year view shows 12-month bar chart; category trend reveals Swiggy is growing
- Session mode: same charts computed from in-memory data

---

## Phase 5 — Net Worth Tracker ✅

> **Goal:** Users track assets and liabilities over time, save monthly snapshots, and see a net worth trend line.

### Backend Deliverable

1. **Assets & Liabilities routes** (see TECH_PLAN §10.12)
   - `GET/POST /v1/assets`, `PATCH/DELETE /v1/assets/:id`
   - `GET/POST /v1/liabilities`, `PATCH/DELETE /v1/liabilities/:id`
   - Asset types: `bank_account | investment | real_estate | crypto | cash | other`
   - Liability types: `home_loan | car_loan | credit_card | student_loan | personal_loan | other`

2. **Net Worth snapshot routes**
   - `GET /v1/networth` — live current totals (sum of all assets − liabilities)
   - `GET /v1/networth/history` — all past snapshots ordered by date
   - `POST /v1/networth/snapshot` — upsert snapshot for current month:
     - Sums all assets and liabilities
     - Stores `totalAssets`, `totalLiabilities`, `netWorth = assets - liabilities`
     - `snapshotDate = first day of current month`

3. **`apps/api/src/services/networth.service.ts`**
   - `computeNetWorth(userId)` — returns live aggregation
   - `saveSnapshot(userId)` — upsert for current month

### Frontend Deliverable

1. **Net Worth page** — `app/(app)/networth/page.tsx`

   **Mode toggle (top right):** "Detailed" | "Quick Entry" segmented control

   **Detailed Mode:**

   *Section A — Summary row (3 stat cards):*
   - Total Assets (emerald)
   - Total Liabilities (rose)
   - Net Worth = Assets − Liabilities (dynamic color: emerald if positive, rose if negative)
   - "Save Snapshot" button beside the cards (primary button)

   *Section B — Assets table:*
   - `<DataTable>` with columns: Name | Type badge | Value (INR, right-aligned) | Valuation Date | Actions
   - Grouped by type (Bank Accounts, Investments, Real Estate, etc.) with a subtotal row per group
   - "Add Asset" button → modal: Name, Type dropdown, Value (number input), Valuation Date (date picker). Currency defaults to INR.

   *Section C — Liabilities table:*
   - Columns: Name | Type badge | Outstanding | Interest Rate | Monthly Payment | Actions
   - "Add Liability" → modal: Name, Type, Outstanding Amount, Interest Rate (%, optional), Monthly Payment (optional)

   *Section D — History chart:*
   - Dual-line chart: one line for Assets (emerald), one for Liabilities (rose), and a filled area for Net Worth
   - X-axis: month labels. Y-axis: INR (formatted in lakhs: `₹5L`)
   - Each data point = one saved snapshot
   - If <2 snapshots: centered empty state with prompt to save more snapshots

   **Quick Entry Mode:**
   - Two large number input fields side by side: "Total Assets (₹)" and "Total Liabilities (₹)"
   - Below: live-computed "Net Worth: ₹X" in large text, colored dynamically
   - "Save Snapshot" button below

2. **Net Worth widget on Dashboard** (add in this phase)
   - A small card at the bottom of the dashboard: "Net Worth" — shows latest snapshot value + delta since last snapshot

### Frontend Design Notes

- **Mode toggle:** Use a pill-style segmented control — `rounded-full bg-zinc-800 p-1`. Active segment: `bg-zinc-600 rounded-full`. This is not a tab — do not use the full-width tab style here.
- **Asset/Liability tables:** Group headers are `text-xs uppercase font-semibold text-zinc-500 tracking-widest` rows with no border, spanning all columns. The subtotal row per group has `font-semibold text-right`. The "Add Asset" button inside each group is a small `+ Add` text link, not a full button — it appends to that group's type.
- **History chart:** Use `recharts` `ComposedChart` with `Line` for assets and liabilities, and `Area` for net worth. Net worth area: `fill="url(#netWorthGradient)"` — use a vertical SVG gradient from `indigo-500` (top) to transparent (bottom) for a premium feel. Define the gradient in a `<defs>` block inside the chart.
- **Quick Entry mode:** Inputs are `text-4xl font-mono text-center w-full bg-zinc-900 border-b-2 border-zinc-700 focus:border-indigo-500 outline-none p-4`. The computed Net Worth below is `text-5xl font-bold font-mono text-center` — this is the statement piece of the page.
- **Save Snapshot feedback:** After saving, animate the three summary cards briefly (a subtle pulse) and show a toast "Snapshot saved for March 2026".
- **Empty state (history chart):** Show a ghost/dimmed chart outline image (SVG) with text "Save your first snapshot to start tracking". This is more engaging than a blank area.

### Demo Checkpoint ✅
- Add HDFC savings ₹2L, FD ₹5L, Stocks ₹3L → subtotals correct
- Add Home Loan ₹50L → Net Worth = −₹40L (shown in red)
- Save Snapshot → toast confirms. Next month: change stock value to ₹4L → save again → chart shows 2 points, upward trend
- Quick Entry: type ₹10L / ₹50L → instantly shows "Net Worth: −₹40L"
- Net worth widget appears on Dashboard

---

## Phase 6 — Data Portability & Storage Modes

> **Goal:** Users can export all data, switch between cloud and local SQLite storage, and permanently delete their data. This completes the privacy-first story.

### Backend Deliverable

1. **Export routes** — `apps/api/src/routes/portability.ts` (see TECH_PLAN §10.12)
   - `GET /v1/export/json` — stream all user data as JSON
   - `GET /v1/export/csv` — stream all transactions as CSV
   - `GET /v1/export/sqlite` — build an in-memory SQLite file with `better-sqlite3`, stream as download. Never written to disk.

2. **Import routes**
   - `POST /v1/import/sqlite` — Multer in-memory, open with `better-sqlite3`, upsert rows using `dedupHash`
   - `POST /v1/import/json` — same flow from JSON format

3. **Account deletion**
   - `DELETE /v1/auth/account` — wipe all user data then delete user row

### Frontend Deliverable

1. **Settings page** — `app/(app)/settings/page.tsx`

   **Two-column settings layout:**
   - Left column (240px): vertical list of settings sections — Profile, Owners, Storage & Privacy, Data Export, Danger Zone
   - Right column: content for the selected section

   **Storage & Privacy section:**
   - Current mode indicator: a large status badge — "☁ Cloud Storage" or "💾 Local SQLite"
   - Subtext describing the mode (see TECH_PLAN §4.4 for exact copy)
   - Action button to switch mode
   - Switching cloud → local: calls `GET /v1/export/sqlite`, loads into OPFS, shows progress indicator
   - Switching local → cloud: reads OPFS file, calls `POST /v1/import/sqlite`, shows merge result

   **Data Export section:**
   - Three buttons in a row: "Export SQLite", "Export JSON", "Export CSV"
   - Below: "Import from backup" — file dropzone for `.sqlite` or `.json` files

   **Danger Zone section:**
   - Red-bordered card section
   - "Delete all financial data" — opens `<ConfirmDialog>` requiring the user to type "DELETE" to confirm
   - "Delete account" — same, requires typing email address

2. **Local SQLite adapter** — `lib/adapters/sqlite.adapter.ts`
   - Implements `DataAdapter` using `sql.js` + OPFS
   - `initSQLite()` — load WASM, open/create DB in OPFS
   - All CRUD methods operate on local DB

3. **StorageMode context fully wired**
   - `StorageModeContext` swaps `adapter` reference on mode change
   - All pages react automatically — no page-level changes needed
   - Mode persisted in `localStorage`

4. **OPFS backup reminder**
   - In SQLite mode: a persistent yellow info banner at the top of every page: "Your data lives only in this browser. [Export backup →]"

### Frontend Design Notes

- **Settings layout:** Left nav items are `text-sm font-medium py-2 px-3 rounded-lg cursor-pointer`. Active: `bg-zinc-800 text-white`. Inactive: `text-zinc-400 hover:text-zinc-200`. Section transitions with a subtle fade.
- **Storage mode card:** Full-width card with a two-column comparison layout — Cloud mode on left, Local SQLite on right. The active mode has an `indigo-500` ring around it. The other option is dimmed. A "Switch" button is inside the active card's panel. Switching shows a `<Dialog>` progress modal with steps: "Exporting data..." → "Loading into browser..." → "Done ✓".
- **Export buttons:** Use `variant="outline"` buttons with icons: `<Download>` for exports, `<Upload>` for import. Button labels include the format: "Export as SQLite (.sqlite)".
- **Danger Zone:** Red border-left on the section: `border-l-4 border-red-700 pl-4`. Buttons use `variant="destructive"`. The type-to-confirm inputs are `font-mono` to make the user feel the weight of the action.
- **OPFS backup banner:** `bg-amber-950 border-b border-amber-800 text-amber-200 text-sm py-2 px-4` — spans full width above the sidebar shell content area. The "Export backup →" link is underlined and bold.

### Demo Checkpoint ✅
- Cloud mode: "Export as SQLite" → downloads a `.sqlite` file; open in DB Browser for SQLite → correct tables and data
- "Switch to Local SQLite" → progress modal → page reloads in local mode → same data visible
- Add a new transaction in local mode → switch back to cloud → import dialog → transaction merged
- "Export as CSV" → opens correctly in Excel
- "Delete all financial data" → type DELETE → confirm → data gone, account still exists

---

## Cross-Cutting Concerns (All Phases)

### Error Handling
- All API responses: `{ success, data, error }` envelope (see TECH_PLAN §10.1)
- Global error handler in `apps/api/src/middleware/`
- Frontend: inline errors on forms; toast notifications for async operations only

### Input Validation
- All API inputs validated with **Zod** (from `packages/types`)
- Frontend forms validated with Zod via `react-hook-form`

### Security
- Rate limiting on auth endpoints: 5 req/min — `apps/api/src/middleware/rateLimit.ts`
- CSRF protection on all state-changing endpoints
- All queries scoped by `userId` from JWT (see TECH_PLAN §5.3)
- Passwords: bcrypt cost ≥ 12

### Multi-tenancy
- Every DB table with user data has a `userId` column
- Drizzle always: `.where(eq(table.userId, ctx.userId))` — client-provided userId is never trusted

### TypeScript
- `"strict": true` in all `tsconfig.json`
- Shared types only in `packages/types` — no duplication

### CI/CD (GitHub Actions)
- Lint + type-check on every PR
- Deploy API to Railway, web to Cloudflare Pages on merge to `main`
- See TECH_PLAN §13 for deployment architecture

---

## Appendix: Tech Stack Cheat Sheet

> Quick reference. Full rationale in TECH_PLAN §2.

| Layer | Choice |
|-------|--------|
| Monorepo | Turborepo |
| Frontend | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Forms | react-hook-form + Zod |
| Charts | recharts |
| Backend | Hono.js on Node.js 20 |
| ORM | Drizzle ORM |
| DB (cloud) | PostgreSQL (via Railway) |
| DB (local) | sql.js + OPFS |
| Auth | Better Auth |
| CSV/Excel | SheetJS (xlsx) + PapaParse |
| Language | TypeScript (strict) throughout |
| Hosting | Railway (API + DB) + Cloudflare Pages (web) |
| CI/CD | GitHub Actions |

# 05 — Reads (merged input, queries, invoices, adapter)

Rule: **neither source alone is complete** (OPFS holds vault-only imports; server holds legacy history). Every reader merges.

## `lib/engine/analytics-client.ts` (423)

- `loadLocalInput()`: read OPFS → fetch cloud (all tables incl. invoice summaries for `invoiceLinks`, txn shares for owner filters) → converge (drop superseded local ids by dedupHash) → upsert cloud → **union** (server canonical + OPFS-exclusive, server wins collisions). Offline/empty → whichever exists.
- Exported `loadMergedInput()` (transactions list too), `refreshLocalCache()`, `fetchReferenceData()` (rules/categories/user-merchants for import), **`fetchServerCounts()` (light migration inventory), `pullAllCloudData(onProgress)` (unbounded migration pull)**. Net-worth tables ride along in fetch/cache/union.
- `localAnalytics` wraps the engine calls; `monthly()` also feeds the legacy IndexedDB snapshot.

## `lib/engine/local-query.ts` (141)

Server-faithful `buildTransactionConditions` port over `LocalCache`: account/dates/search/type, `uncategorized`, owner logic incl. `unassigned` (assigned-set semantics copied), investment/one_time/regular nature via the investment-category set, `isOneTime` legacy param, date-desc/id-desc sort, pagination. Returns UI-joined rows (category/account/owners with names). Fixture-verified per filter.

## `lib/engine/local-invoices.ts` (355)

- `composeInvoiceDraftLocal()`: header + links → live cached txns (joined categories/owner names) → `buildInvoiceAnalysisLocal`. Generated invoices prefer **frozen** cached items. Returns page-shaped detail + `offline: true`.
- Lifecycle: `createLocalInvoice` (`local-` id prefix = the local/server discriminator), `generateLocalInvoice` (snapshot live → frozen items), `saveLocalDraft`, `draftLocalInvoice`, `deleteLocalInvoice` — all with debounced backup.

## Consumers

- `transactions.store.fetchTransactions`: unlocked → merged input through `queryLocalTransactions` (mapped to store shape); else legacy server fetch.
- `DashboardClient.loadInsights`: `localAnalytics.monthly` → server fallback.
- `storage-mode.tsx` cloud adapter: all four insight methods try `localAnalytics` first, server fallback (the old stub returned zeros).
- Invoices page: merges local statements/headers into lists; detail via server → offline compose fallback; lifecycle handlers branch on `isLocalInvoiceId`.

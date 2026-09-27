# 01 — `@momoney/local-engine` (new package)

Isomorphic core: zero Node-only deps, runs in browser Workers, Node, and later React Native.
Consumed as compiled `dist/` (Turbopack can't resolve TS `.js`-suffix sources — see 02).

## `src/types.ts` (+153)

All local row shapes mirroring server Drizzle rows, plus:
- `LocalOwnerShare`, `LocalInvoice*` (headers, statements, items with embedded owner JSON).
- `VaultSnapshot`: required core (`transactions/categories/statements/owners` as txn-shares) + **optional** reference tables (`financialAccounts/ownerList/rules/merchants/invoices/…`). Optional so older sealed vaults still open.

## `src/dedup.ts`

- `dedupKey()` builds the exact server string (`accountId|ISO date|amount.toFixed(2)|desc[0:50]`).
- `computeDedupHashBrowser()` — SubtleCrypto SHA-256, byte-identical to server `createHash` (verified in tests); FNV fallback only for non-secure contexts, flagged by `isFallbackHash()`.

## `src/analytics.ts`

In-memory port of `InsightsService`: `getMonthlyInsightsLocal`, `getYearlyInsightsLocal`, `getCategoryComparisonLocal`, `getCategoryAveragesLocal`. Same math (transfers excluded, credit-in-expense reduces spend, owner-share attribution, invoice-vs-transaction month via `invoiceLinks`). Input: `LocalAnalyticsInput`.

## `src/invoices.ts`

`buildInvoiceAnalysisLocal` — line-faithful port of server `buildAnalysis` (owner buckets, regular/one-time × spending/investment splits, category totals). Fixture-verified (splits, refunds, transfer exclusion).

## `src/opfs-schema.ts` (+392)

**Single source of truth** for the on-device SQLite: `OPFS_SCHEMA` DDL (12 tables incl. `local_changelog`), `OPFS_READ_TABLES`, and batch builders (`buildUpsertBatch`, `buildPatchTransaction`, `buildSetOwners` with server-identical equal-split math, `buildDeleteBy*`, invoice lifecycle builders, changelog builders). Browser worker AND Node tests consume the same builders — SQL can't drift. Verified against `node:sqlite` (upsert idempotency, updates, deletes, clear).

## `src/storage.ts`

`LocalVault` seam + `createIndexedDbVault()` (legacy snapshot cache) and the `vault_blobs` DDL comment. `VaultSnapshot` re-exported from `types.ts` (deduplicated in Phase 3).

## `src/crypto.ts`

Hash-wasm Argon2id → secretbox-wrapped DEK → XChaCha20-Poly1305 snapshot envelope + raw `sealBytes`/`unsealBytes` (OPFS file seal). Portable hand-rolled base64 (no `atob`/`Buffer` — Worker-safe). `VaultParams` maps to DB `opslimit`/`memlimit` (iterations/memory-KiB). Full round-trip/wrong-key/tamper suite executed. (libsodium-wrappers was evaluated first; 0.7.16's ESM entry is broken.)

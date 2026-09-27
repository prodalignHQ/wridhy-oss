# 04 — OPFS database (workers, facade, seal)

## `apps/web/workers/db.worker.ts` (457)

Serialized message worker (`opQueue` — every op runs to completion; kills open/open and read/seal interleavings). Ops: `boot` (see below), `init/upsert/readAll/clear`, `deleteByStatement/deleteByIds`, `patchTransaction/setOwners/getByIds`, `getChangelog/clearChangelog`, invoice ops (`rewriteInvoiceLinks/deleteInvoice/deleteInvoiceItems/setInvoiceStatus`), `stats` (counts + sealed, never creates a DB), `seal/unseal/sealedExists`.

Key internals:
- **Boot handshake**: main thread fetches `wa-sqlite-async.wasm` once and transfers bytes; Emscripten instantiates from `wasmBinary` (blob-URL workers can't resolve relative fetch).
- **Singleton** `Factory()` + one `vfs_register('opfs')` per worker lifetime (re-registration threw + corrupted VFS maps).
- **Atomic open**: handle assigns only after open + schema + probe; failures quarantine to `momoney.db.corrupt-<ts>` (never silent-delete) and retry once.
- **Sealed guard**: refuses to shadow a sealed DB with a fresh empty one (`SEALED` error → callers fall back).
- **Seal/unseal**: close → read file → XChaCha seal → write `.sealed` → remove live (and reverse), DEK copies wiped.

## `lib/engine/opfs-db.ts` (557)

Promise facade over the worker (id-tracked pending map, timeouts, crash recovery): `cacheServerRows`, `readLocalCache` (null on empty/unavailable), `deleteStatementFromCache/deleteTransactionsFromCache`, mutation facades, changelog readers, invoice facades, `restoreSnapshotToCache`, pending-tracking (`read/writePendingStatements`, `getPendingWork/hasPendingWork`, `markBackupComplete`, `lastBackupAt`), `getLocalDbStats`, and `lastWorkerError` capture surfaced in the vault diagnostics card. `DbWorkerRequest/Response` types live in the worker file.

## Supporting

- `workers/parser.worker.ts` + `lib/engine/worker-client.ts`: statement parsing off-main-thread with main-thread fallback (relative `new URL()` paths — the `@/` alias doesn't resolve in worker URLs).
- `workers/wa-sqlite.d.ts`: untyped-vendor declarations.
- `public/wa-sqlite-async.wasm` (1.1 MB vendored): **async/Asyncify build is mandatory** — the OPFS VFS is async and the sync build coerces returned Promises to ints (open "succeeds" pending, then `filename`-of-undefined crashes). Verified in Node (factory/wasmBinary/open/exec/query/close).

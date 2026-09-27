# 06 — Mutations, changelog & backup triggers

Rule: **vault unlocked → edits stay on-device, period.** Sending server PATCH/PUT for vault users isn't redundant, it's a leak — plus it diverges local state.

## `lib/engine/mutations.ts` (119)

- `useLocalMutations()` — single gate (DEK present). Every mutation branches through it.
- `localSetCategory/localSetOneTime/localSetOwners(ids, …)` — worker writes, read-back rows, display-data resolution (category ref, per-txn shares), then `scheduleEncryptedBackup()`.
- `scheduleEncryptedBackup()` — 5s debounce; `flushEncryptedBackup()` — immediate, gated on `hasPendingWork()`, never throws. Triggers call flush; edits call schedule.

## Changelog (`local_changelog` + worker ops)

Written by `patchTransaction`/`setOwners` (shared builders), read/cleared via `getChangelog`/`clearChangelog(upToId)`. `pushEncrypted` captures the max id *before* snapshotting and clears up to its mark on success — entries written mid-build belong to the next backup. Not yet read for deltas (Phase 5); today it powers the pending-edits count.

## `lib/engine/backup-triggers.ts` + store `lock()`

Registered once in `LayoutWrapper`: `online` → flush, `visibilitychange(hidden)` → flush, `beforeunload` → best-effort floating attempt (documented unreliable; OPFS durability is the real guarantee). `lock()` = flush → seal → wipe, in that order (flush needs the DEK).

## Pending observability

`getPendingWork()` → `{statements[], edits}`; `markBackupComplete()` clears both markers + stamps time. Vault page shows *"Last backup … • N changes not yet backed up"* / *"everything backed up"*. Statements history badges come from the same source.

## `transactions.store.ts` deltas (+~190)

All six single/bulk category/one-time/owner methods branch: local path merges worker rows (preserving joined objects — strictly better than the old replace-with-server-response, which dropped the `account` join); server path byte-identical to before. `fetchTransactions` uses the merged input when unlocked (see 05).

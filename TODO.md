# TODO — Full End-to-End Encryption

> Goal state: a user signs up, their data is **never plaintext off-device**, across devices, with recovery and rotation — and every claim is verified, not promised.
> Last updated: 2026-09-27. Completed work lives in `docs/dev/done/001–003`.

**Legend:** `P0` blocks the privacy guarantee · `P1` needed for managed launch · `P2` hardening/polish.

---

## Milestone A — Close the plaintext gaps (P0) — largely built, see DONE 006

- [x] **A1. Explicit backfill flow.** `MigrationWizard`: inventory → unbounded pull → encrypt → decrypt + count-match receipt. Offered in onboarding (server rows exist) and Settings → Vault.
- [x] **A2. Migrate server-driven reads to OPFS.** DONE for transactions, dashboard, insights, invoices, accounts, owners, rules (+preview/reapply/category-delete), merchants (cached, no UI), net-worth (live compute, snapshots, drafts, asset/liability CRUD). Remaining server-direct: reference pickers merged (not pure), invoice server lifecycle for non-local ids (by design).
- [x] **A3. Plaintext retirement.** `DELETE /v1/vault/user-data` (vault-required, typed `DELETE`, ordered deletes, per-table receipt) + permanent UI receipt + retired marker. E2E covers rejection paths.

## Milestone B — True multi-device + conflicts (P0/P1)

- [ ] **B1. Incremental sync (reads the changelog).** Push/pull only logged rows instead of full snapshots; `clearChangelog` on success (primitives exist, reader missing).
- [ ] **B2. Conflict UI.** Version conflicts currently auto-retry once, then error. Need a merge view (per-field last-write-wins + manual resolve for splits/owners).
- [ ] **B3. Device list polish.** Show per-device last-sync; warn on long-silent devices.
- [ ] **B4. QR device pairing (passwordless join).** Today a new device joins via vault password or recovery code (password is mandatory at setup precisely so this always works). The upgrade: new device shows a QR with an ephemeral pubkey + session id; an existing unlocked device scans and POSTs the DEK wrapped to it via short-TTL opaque relay endpoints; new device unwraps, registers its own passkey. Needs relay API, QR lib, camera permission flow, and the same audit treatment as the rest of the trusted path.

## Milestone C — Key lifecycle (P1)

- [ ] **C1. DEK rotation UI.** Re-generate DEK → re-encrypt snapshot → re-wrap for all kept devices → drop revoked wraps, atomically. (Revoke today only removes future access.)
- [ ] **C2. Password change / recovery-code rotation.** Re-wrap flows exist as primitives (`wrapDek`/`unwrapDek`); no UI.
- [ ] **C3. Lost-everything flow copy.** Confirm the "no keys, no data" messaging is consistent across onboarding, vault page, and `/privacy`.

## Milestone D — At-rest + client integrity (P1)

- [ ] **D1. Page-level encryption decision.** Either run the SQLite3MC custom wa-sqlite build (`PRAGMA key`, ~885 KB, emscripten step in CI) or formally accept file-seal. Decide before audit — auditors will ask why live pages are plaintext SQLite.
- [ ] **D2. Reproducible web builds + SRI.** Close the "compromised bundle exfiltrates the DEK" hole in the threat model: pinned, hash-verified client assets.

## Milestone E — Proof (P1/P2, some need calendar time)

- [ ] **E1. Real-passkey matrix.** Touch ID / Windows Hello / Android / hardware keys; PRF support detection accuracy per browser.
- [ ] **E2. Real-OPFS matrix.** Chrome / Safari / Firefox worker run; quota and private-mode behavior; low-end Android Argon2id timing (tune iterations/memory, possibly per-device params — schema already supports it).
- [ ] **E3. Kill-test checklist from DONE 003** (lock-mid-debounce, offline-edit-reconnect, killed-beforeunload) run on real browsers, results recorded.
- [ ] **E4. Third-party audit.** Code is auditor-ready (~1.5k-line trusted path + `vault-e2e.mts`); procurement, not engineering.

## Later (explicitly out of E2E scope)

- [ ] **Mobile (Android/iOS).** Same envelope via noble/hash-wasm on React Native; Rust core only if profiling demands it.
- [ ] **Managed service productionization.** Deployment, billing, device-conflict UX at scale.

---

## Known sharp edges (do not regress)

- `vaultBlobs→vaultWraps` shares only `userId` (no direct FK): fetch wraps with a separate query, never relational `with` (see CLAUDE.md).
- Vault salts are standard-base64; PRF input derivation must normalize to base64url first (`derivePrfInput` does — don't bypass it).
- `beforeunload` backup is best-effort; OPFS durability is the real guarantee.
- `PUT /v1/vault` is full-replace with client-set version; only `/v1/vault/sync` is concurrency-safe.
- `public/wa-sqlite.wasm` is vendored stock SQLite (no cipher inside) — refresh on wa-sqlite upgrades.

## Roro's

- If offline, do not enable passkey, encryption and all that.

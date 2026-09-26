# TODO — Full End-to-End Encryption

> Goal state: a user signs up, their data is **never plaintext off-device**, across devices, with recovery and rotation — and every claim is verified, not promised.
> Last updated: 2026-09-27. Completed work lives in `docs/dev/done/001–003`.

**Legend:** `P0` blocks the privacy guarantee · `P1` needed for managed launch · `P2` hardening/polish.

---

## Milestone A — Close the plaintext gaps (P0)

- [ ] **A1. Explicit backfill flow.** "Pull my server history into the vault": page through all server rows → converge into OPFS → encrypt → push → show a verification receipt (`N` server txns → `N` in snapshot, decrypt round-trip verified). Onboarding offers it when server rows exist; Settings offers it anytime.
- [ ] **A2. Migrate server-driven reads to OPFS before any deletion.**
  - [ ] Dashboard insights → `localAnalytics` (shapes already match) with server fallback.
  - [ ] Transactions list → local query ops in the worker (filters/sort/pagination over OPFS) with server fallback.
  - [ ] Invoice lifecycle (create/generate/draft/delete, currently server-only) → local-first or explicit online-only gating for vault users.
  - [ ] Rules / merchants / owners / accounts / net-worth CRUD (all still server PATCH/POST) → vault-gated local mutations like transactions got in `mutations.ts`.
- [ ] **A3. Plaintext retirement.** After verified backfill: "Delete server-side plaintext" (new endpoint, typed confirmation, requires unlocked vault + confirmed recovery code). Managed-mode Postgres end state: `users` + `vault_blobs` + `vault_wraps` only. Decide retention grace period and communicate it.

## Milestone B — True multi-device + conflicts (P0/P1)

- [ ] **B1. Incremental sync (reads the changelog).** Push/pull only logged rows instead of full snapshots; `clearChangelog` on success (primitives exist, reader missing).
- [ ] **B2. Conflict UI.** Version conflicts currently auto-retry once, then error. Need a merge view (per-field last-write-wins + manual resolve for splits/owners).
- [ ] **B3. Device list polish.** Show per-device last-sync; warn on long-silent devices.

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

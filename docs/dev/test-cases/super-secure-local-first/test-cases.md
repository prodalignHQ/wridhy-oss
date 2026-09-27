# Test Cases — super-secure local-first branch vs `main`

> Scope: 33 commits, 93 files, ~14.6k insertions on `super-secure` since `main@f6e215c`.
> Covers: on-device parsers, encrypted vault (Argon2id/PRF/recovery), OPFS database + seal,
> local-first imports/mutations/reads, versioned encrypted backup, multi-device wraps,
> onboarding + unlock gates, plaintext migration + retirement, landing/privacy refresh.
>
> Legend: **[A]** automated (command given) · **[M]** manual browser/API · **P0** release-blocking.

---

## 0. Automated gate (run first — everything below assumes green)

- [ ] **[A]** `pnpm --filter @momoney/local-engine build && pnpm --filter @momoney/local-engine type-check`
- [ ] **[A]** `pnpm --filter @momoney/parsers build && type-check` (rules-engine too)
- [ ] **[A]** `cd apps/web && npx tsc --noEmit` (must be exit 0)
- [ ] **[A]** `cd apps/web && npx next build` (all routes incl. `/privacy`, `/unlock`, `/onboarding/vault`, `/settings/vault`)
- [ ] **[A]** `cd apps/api && tsx ./vault-e2e.mts` against `momoney_db_secure` → **E2E PASS** (PUT→GET→decrypt→wraps→sync→409→DELETE→retire-checks). P0.
- [ ] **[A]** Shared-SQL suites via `tsx` in `packages/local-engine` (upsert idempotency, patch/owners/changelog, net-worth tables, invoice parity fixture, crypto round-trip/tamper).

---

## 1. Onboarding & unlock gates (P0)

- [ ] **[M]** Fresh signup → verify → login lands on `/onboarding/vault` wizard (two-keys explainer).
- [ ] **[M]** Passkey path: taps → mandatory password step appears with join-copy → create → recovery code → type-to-confirm gate blocks dashboard until it matches → optional migrate step only if server rows exist.
- [ ] **[M]** Password path: 12-char minimum enforced, mismatch blocked, same recovery gate.
- [ ] **[M]** Skip → dashboard + setup banner; banner CTA reopens wizard.
- [ ] **[M]** Existing vault + fresh login → full-screen `/unlock` (no sidebar), method auto-detected (passkey picker / password / recovery); success returns to dashboard; no "continue without unlocking" anywhere.
- [ ] **[M]** Unlock error copy is human (`Wrong vault password…`, typos hint for codes) — never raw codes.
- [ ] **[M]** Logout flushes + seals + wipes (verify via vault diagnostics next login: backup timestamp fresh, `.sealed` present while locked).

## 2. Vault, keys & devices (P0)

- [ ] **[M]** `/settings/vault`: setup → recovery code shown exactly once → device list with labels/dates → revoke removes exactly that wrap (verify via GET blob).
- [ ] **[M]** Add-password section appears only for passwordless vaults; sets wrap; new-device join works after.
- [ ] **[M]** New device (incognito): password/recovery unlock → snapshot restores into OPFS (Transactions populate) → "make this device passwordless" offer → biometric unlock next login.
- [ ] **[M]** Wrong password / tampered blob / wrong recovery code all fail closed with clear messages.
- [ ] **[M]** Sync-now + Check-for-updates buttons; version increments server-side; stale client gets 409 → auto-retry path.

## 3. Statement import (P0)

- [ ] **[M]** Preview renders locally for CSV/XLS/XLSX/PDF (all 4 banks); server fallback only if Worker fails.
- [ ] **[M]** Confirm Import unlocked → "Saved N on this device" → "Backed up encrypted" → history shows row, Transactions + Insights include rows immediately.
- [ ] **[M]** Confirm Import locked-with-vault → inline unlock gate (password/passkey/device picker), file+month preserved, import auto-continues after unlock. No readable upload happens.
- [ ] **[M]** Confirm Import no-vault → legacy upload + "Readable server backup…" toast wording.
- [ ] **[M]** Re-import same file → all duplicates skipped, counts add up, no duplicate React keys in history.
- [ ] **[M]** Delete server statement (works, converges cache); delete local-only statement (no server call, no 404); delete already-gone server row (404 → converges locally).
- [ ] **[M]** Offline import → saved locally + pending badge; reconnect → backup fires; badge clears.

## 4. Transactions: reads & mutations (P0)

- [ ] **[M]** With vault: every filter (search, dates, account, category incl. uncategorized, owner incl. unassigned, type, investment/one-time/regular, pagination) matches server semantics; joins (category/account/owner names) render.
- [ ] **[M]** Category/one-time/owner edits (single + bulk, both pages) apply instantly, survive reload, and trigger **zero** `/v1/transactions*` PATCH/PUT in the Network tab while unlocked.
- [ ] **[M]** Same edits with vault locked/absent → legacy server calls, unchanged behavior.
- [ ] **[M]** Debounce: 10 rapid edits → exactly one `/v1/vault/sync` ~5s after the last; vault page shows pending count then "everything backed up".
- [ ] **[M]** Kill cases: edit → lock within 5s (backup still lands); edit → close tab (data safe locally, badge persists); edit offline → online (backup fires).

## 5. Insights, dashboard, invoices (P0)

- [ ] **[M]** Dashboard cards + insights page reflect vault-only imports (monthly/yearly/comparison/averages, both accounting modes, owner filters).
- [ ] **[M]** Invoice composer lists local-only statements; local create → generate → draft → delete all work offline with frozen-item snapshots; server invoices untouched.
- [ ] **[M]** Invoice detail server failure → badged "Offline preview" composed from cache.
- [ ] **[M]** Cross-device: phone edit → laptop tab focus (or Check-for-updates) → Transactions + Dashboard refresh via broadcast.

## 6. Migration & retirement (P0 for managed story)

- [ ] **[M]** Settings → Vault → "Secure existing server data" with legacy rows present: inventory table → move with progress → receipt all-✅ → typed-DELETE → deletion receipt + retired marker. Mismatched counts block deletion.
- [ ] **[M]** Download encrypted backup → file validates as JSON blob; Restore-from-file round-trips (PUT → refresh → unlock verifies).
- [ ] **[M]** Post-retirement: server lists empty; app fully functional from OPFS+vault; retired marker persists.
- [ ] **[M]** Net-worth rows ride the snapshot (no silent omission in receipts).

## 7. OPFS engine & seal (P0)

- [ ] **[M]** Vault diagnostics card: per-table counts correct after import; `sealed file present` while locked; verbatim worker errors if any.
- [ ] **[M]** Lock → live file sealed, unlock → restored; no `.corrupt-*` files appear in normal use; quarantine warning (if ever) names the file.
- [ ] **[M]** Fresh profile + unlock → full restore; seal/unseal cycles don't fork data (spot-check counts).

## 8. Landing, privacy, middleware (P1)

- [ ] **[M]** Landing: 100%-private copy, feature-card link, coming-soon sync block; `/privacy` renders both tabs (Everyone/Technical) with diagrams; logged-out `/privacy` → 200, `/dashboard` → login redirect.
- [ ] **[M]** `/unlock` logged-out → login; `/onboarding/vault` with existing vault → dashboard.

## 9. Regression: non-vault + local-mode binary (P0)

- [ ] **[M]** No-vault user journey end-to-end unchanged (import → server rows → history → insights), only toast wording differs.
- [ ] **[M]** Standalone binary (`pnpm run build:binary`): boots, no vault nags/redirects on dashboard, imports land in local SQLite, Settings vault remains available but unpushed.

## 10. Real-device matrix (P1, calendar time)

- [ ] **[M]** Platform passkeys + PRF: Touch ID / Windows Hello / Android / hardware key; PRF-unsupported browser degrades to password path with honest copy.
- [ ] **[M]** OPFS worker: Chrome / Safari / Firefox / private windows; quota-full behavior.
- [ ] **[M]** Argon2id timing on low-end Android (tune iterations/memory; schema already supports per-vault params).

# 03 — Vault, crypto transport & sync

## API — `apps/api/src/routes/vault.ts` (+233), `app.ts`, `vault-e2e.mts`

- `GET /v1/vault` → blob + `wraps[]` (two queries; relational `with` is impossible — no direct FK, see 08).
- `PUT /v1/vault` → setup/full-replace (client-set version; wraps excluded from body).
- `POST /v1/vault/sync` → `{cipher, nonce, baseVersion}`; 404 without vault, **409 on stale version**, server-incremented version. The only backup path that matters.
- `POST /v1/vault/wraps` (upsert per credential) + `DELETE /v1/vault/wraps/:id` (revoke; rotation itself is backlog).
- `vault-e2e.mts`: real signup → PUT → GET byte-match → client decrypt → wraps register/list/per-device-unwrap/cross-reject/revoke → sync v2 → stale-write 409 + intactness → DELETE → NO_VAULT. The privacy claim is executable.

## Client crypto transport — `lib/engine/vault-sync.ts` (319)

- `setupVaultWithPassword` (password+recovery wraps), `setupVaultWithPasskeys` (passwordless: PRF wraps + mandatory recovery; caller-provided Argon2 params so PRF input derives from the salt pre-setup; per-wrap best-effort with `wrapError` instead of stranding).
- `unlockWithPassword/Passkey/Recovery` (PRF output wiped in `finally`), `registerPasskey` (proves PRF evaluability *before* storing the wrap), `revokePasskey`.
- `syncSnapshot` (legacy PUT) vs `syncEncryptedSnapshot` (versioned `/sync` + one refetch-and-retry on CONFLICT).
- `buildVaultSnapshot(cache)` shapes OPFS → snapshot (all tables).

## PRF — `lib/engine/webauthn-prf.ts` (145)

Zero-dependency `create()`/`get()` with `prf` extension, portable base64url helpers, `derivePrfInput = SHA-256("MoMoney-Vault-PRF-v1" ‖ salt)` with base64-variant normalization (the bug that would have bricked ~⅓ of passkey vaults). Capability probe degrades gracefully.

## Session — `lib/store/vault.store.ts` (280)

Module-scoped DEK (never in React state → never serialized), `wipeBytes` on every rotation. Actions: `refresh/setup/adoptSession` (passkey-first onboarding path), three unlocks (each: unseal → decrypt → **restore snapshot to OPFS**), `addPasskey/revokePasskey`, `sync/pushEncrypted` (changelog mark captured pre-snapshot, markers cleared on success), `lock` (**flush → seal → wipe**, in that order), `isUnlocked()` gate used by every mutation/read branch.

## Onboarding — `app/(app)/onboarding/vault/page.tsx` (+234)

Two-keys explainer → passkey-first (two authenticator taps: register, prove PRF) or password → recovery code with **type-to-confirm gate** → dashboard. Setup encrypts *current* OPFS (backfills existing users). Existing vaults redirect away; skip is per-session. Dashboard redirects here (no vault) or to the unlock gate (locked vault), with banners as the persistent fallback.

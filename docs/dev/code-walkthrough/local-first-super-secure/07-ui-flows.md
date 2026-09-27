# 07 — UI flows

## Statements (`app/(app)/statements/page.tsx`, +356)

- Preview: local Worker parse → server `/preview` fallback; month defaults from earliest txn.
- Import: validation → **vault gate** (blob exists + locked → inline unlock prompt: password / passkey / device picker; file + month preserved; unlock auto-continues) → local import (**read-back verified, throws instead of lying**) → unlocked: `pushEncrypted` ("server sees only ciphertext") / no vault: legacy `/upload` ("Readable server backup…") + dedupHash converge + local shell dropped.
- History merges OPFS rows via permanent `isLocal` origin marker (the badge flag `localOnly` caused duplicate keys + delete-404s when it doubled as merge identity — fixed). Deletes check origin; server 404s converge locally.
- `fetchReferenceData` feeds the local categorizer.

## Invoices (`app/(app)/invoices/page.tsx`, +322)

Server-driven lifecycle preserved; local branches keyed on `isLocalInvoiceId` / vault state: merged lists, `openLocalInvoice` composer, local create/generate/draft/delete, `refreshActiveDetail` (OPFS recompose when unlocked, server refetch otherwise), "Offline preview" badge. Invoice *transaction edits* route through `mutations.ts` (see 06).

## Transactions store (see 06) + Dashboard

- Dashboard: vault-gated routing (no vault → onboarding wizard / setup banner; locked vault → full-screen `/unlock` gate once per session, then persistent Unlock banner), `loadInsights` local-first, `momoney:vault-updated` listener refetching insights on cross-device pull.
- `auth.store.logout()` locks first (flush + seal + wipe) — logout previously left OPFS unsealed on disk.
- Onboarding wizard (`app/(app)/onboarding/vault`): two-keys explainer → passkey-first (register + prove PRF, then **mandatory** password step — passkeys are device-bound, the password is the portable join factor) or password → type-to-confirm recovery → dashboard. Setup encrypts current OPFS (backfills existing users).
- Full-screen unlock gate (`app/unlock`, no sidebar): method detection, passkey-first with device picker, password with login-vs-vault hint, recovery one tap away with explicit "not working?" escapes, plain-language errors, no "continue without unlocking" (everything goes through the vault), auto-return to dashboard; post-password/recovery "make this device passwordless" offer for new-device joining.
- Transactions page listens for `momoney:vault-updated` and refetches the list.
- Settings vault page: status/cipher metadata, recovery-code-once card, unlock (3 paths + device picker), password section (set state, or add-password for legacy passwordless vaults), device management (labels, revoke), sync now + check-for-updates (pull), lock, backup-status line, **diagnostics card** (per-table counts, sealed state, pending, verbatim worker errors).

## Landing + privacy (public)

- Hero/Features/HowItWorks/Footer/Navbar reframed to 100% private + zero-knowledge-sync-coming-soon; `/privacy` (middleware-allowlisted) with Everyone/Technical tabs (`PrivacyTabs.tsx`).

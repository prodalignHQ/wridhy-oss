# 007 — Offline Shell Spec: service worker + session fallback (SPEC, NOT BUILT)

**Date:** 2026-10-02
**Status:** 📝 SPEC — design agreed, no code yet. Unlock/offline-unlock and merged reads below already ship; this covers the remaining cold-offline gap.
**Category:** Architecture / Offline / PWA
**Tags:** `#offline` `#service-worker` `#pwa` `#spec`

---

## 1. What already works offline (warm tab, unlocked vault)

- All reads (transactions, insights, invoices, net-worth, reference lists) serve OPFS; server fetches fail into cache fallbacks.
- All mutations write OPFS + changelog; backups queue as pending markers and flush on `online` / tab-visible / lock.
- Unlock itself works offline via cached vault metadata (`momoney_vault_meta`: salt/params/wraps, never keys/ciphertext); snapshot view rebuilds from the unsealed OPFS database.
- Reference pickers merge OPFS-first with server convergence when online.

## 2. What does NOT work offline today (this spec's scope)

1. **Cold boot.** Reload with no network = browser error page. No service worker precaches anything.
2. **Auth gate.** `(app)/layout.tsx` does a *server-side* session check → offline always lands on `/login`, which needs network. A cached cookie is insufficient as implemented.
3. **First unlock on a fresh profile.** No cached metadata + no network = no salt/wraps = cannot derive. Inherent (nothing to derive from); the UX must say so instead of spinning.
4. **Server-id invoice operations** (create/generate on pre-retirement invoices) fail raw; acceptable if messaged, queued in Phase 5.
5. **Conflict merge** (TODO B2): two offline devices → last-writer-wins silently. Minimum viable here: surface "changed elsewhere while offline" instead of quiet overwrite.

## 3. Proposed design

### 3a. Service worker (new `apps/web/worker/sw.ts` via `next-pwa` or hand-rolled)
- **Precache:** app shell (HTML for `/login`, `/unlock`, `/dashboard`, `/settings/vault`), `_next/static` (content-hashed, safe), `wa-sqlite-async.wasm`, public assets. Versioned cache, update-on-relaunch (never mid-session — a SW update swapping JS under a live DEK session risks chunk mismatch; `skipWaiting` only when no vault is unlocked).
- **Runtime:** `NetworkFirst` for `/v1/*` and `/api/*` with short timeout → cache fallback where a cached response exists; `CacheFirst` for static. Never cache vault blob responses beyond the existing metadata flow (ciphertext in HTTP cache widens exposure for zero benefit — OPFS is the store).
- **Outbox (Phase 5 hook, stub now):** failed mutating requests (`POST/PUT/PATCH/DELETE /v1/*`) recorded with body + idempotency key (dedupHash where applicable); replayed on `online` in order. Until the server supports it, replay only the safe subset (none yet — stub the plumbing, keep failing loudly).

### 3b. Client-side session fallback
- On boot with no network: read `better-auth.session_token` presence (cookie readable client-side? confirm httpOnly flag — if httpOnly, fall back to a `momoney_session_hint` localStorage flag written at login) + cached user profile (`momoney_user_profile`, written by `AuthHydrator`) → render shell in "offline mode" banner state instead of redirecting to `/login`.
- Server re-validates on reconnect (existing middleware); any 401 then forces real login. Trust window: profile is display-only, never authorization — every mutating API call still authenticates server-side when online.

### 3c. Offline unlock path (mostly built — wire the last meter)
- UnlockGate already falls back to `readCachedVaultMeta()` + `stageBlob`. Remaining: seed the metadata cache on more paths (currently subscribed to blob updates — verify it fires before first offline use; add explicit write in setup/adopt if missing) and surface "offline mode" chrome (UnlockGate notice exists; add the same to dashboard banner area).

### 3d. What stays online-only (documented, not built)
- Signup, password reset, email verification.
- First-ever vault setup on a device with empty OPFS (nothing to encrypt — correctly blocked, message it).
- Server-id invoice lifecycle for pre-retirement invoices (message it, don't queue yet).

## 4. Acceptance
- Airplane-mode drill: load app online → unlock → enable airplane mode → reload tab → shell renders from SW → unlock offline via cached metadata → import/edit/read work → pending markers accrue → disable airplane mode → backups flush, markers clear, no duplicates, no lost edits.
- Kill drill: airplane mode → edit → kill tab → reopen offline → edits present, pending markers present.
- Auth drill: clear cookies offline → redirected to a cached login page stating offline (not a browser error); login succeeds only on reconnect.

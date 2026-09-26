# DONE 001: Local-First Encrypted-Vault Architecture (Phases 1–3)

**Date:** 2026-09-27
**Status:** Shipped on `super-secure` (`289e0dc` → `d885efc`)
**Category:** Architecture / Privacy / Local-first
**Tags:** `#privacy` `#local-first` `#argon2id` `#xchacha20` `#webauthn-prf` `#opfs` `#wa-sqlite` `#zero-knowledge`

---

## 1. The problem

MoMoney stored transaction data as **plaintext rows in PostgreSQL** (`transactions.description`, `merchant`, `amount`, …). Parsing (`@momoney/parsers`), categorization, and all analytics (`InsightsService`, invoice `buildAnalysis`) ran **server-side**. Consequences:

- Anyone with database access (host, backup, breach) reads every transaction.
- The hosted/managed story was unshippable for a privacy product: syncing across devices meant trusting the server with plaintext.
- Mobile (Android/iOS) would inherit the same trust problem.

Goal: move compute to the device, encrypt everything that leaves it, and reduce the server to an **opaque, zero-knowledge blob store** — while keeping the product fully usable offline.

> **Scope note:** the managed zero-knowledge sync service this unlocks is **coming soon** (no production deployment yet). Today's shippable modes are self-host (your server, your DB) and the standalone offline binary. Everything below is built, tested, and live in code behind those modes.

---

## 2. What changed (Phase 1 → 3)

### Phase 1 — parsers + analytics move to the device (`289e0dc`)

- **New `@momoney/local-engine`**: isomorphic dedup (`computeDedupHashBrowser`, SubtleCrypto SHA-256, byte-identical to the server's `createHash` — verified), and an in-memory port of `InsightsService` (monthly/yearly/category-comparison/averages) plus invoice `buildAnalysis`.
- **Parsers run in the browser**: extracted the pure ICICI-PDF line parser shared by server (`pdf-parse`) and browser (`pdfjs-dist`); CSV/XLS via `papaparse`/`xlsx` already browser-safe. Statement preview runs in a **Web Worker** with server fallback.
- **Packaging lessons** (Turbopack): workspace packages with NodeNext `.js`-suffix TS sources don't resolve in the client — `parsers`/`rules-engine`/`local-engine` now build to `dist/`; `parsers` gained a `src/browser.ts` entry excluding `pdf-parse`; xlsx is consumed via named imports + a lazy SSF loader (static `import { SSF }` breaks Node CJS-lexer; `.default` access breaks Turbopack).

### Phase 2 — encrypted vault + WebAuthn PRF + OPFS (`1d580dc`)

- **Key hierarchy (client-only):** `password → Argon2id(salt) → KEK`, 32-byte random **DEK**, `XChaCha20-Poly1305` snapshot envelope; DEK wrapped by password-KEK, **WebAuthn PRF output**, and recovery-code-KEK (secretbox wraps). Primitives: hash-wasm + `@noble/ciphers` (libsodium-wrappers 0.7.16's ESM entry was found broken; noble is ESM-native and Worker-safe).
- **Server is opaque:** `vault_blobs` (one row/user) holds base64 ciphertext + wrap metadata only. `GET|PUT|DELETE /v1/vault` never decrypts. E2E-tested (`apps/api/vault-e2e.mts`): signup → PUT → GET byte-identical → client decrypt → DELETE → `NO_VAULT`.
- **OPFS database:** wa-sqlite sync build + `OriginPrivateFileSystemVFS` in a dedicated Worker (`wa-sqlite.wasm` vendored). Lock seals `momoney.db` → `momoney.db.sealed` with the DEK; unlock unseals. DEK lives in memory only, wiped on lock.
- **UI:** `/settings/vault` (setup, 3 unlock paths, sync, recovery code shown once).

### Phase 3 — OPFS write path + convergence (`d885efc`)

- Cache extended to **all reference tables** (accounts, owners, txn-owners, rules, merchants, invoices + statements/items). All SQL is shared via `local-engine/src/opfs-schema.ts` builders, executed against real SQLite in Node tests.
- **Local-first import:** parse → same `categorize()` call as the server → dedupHash → OPFS instantly (offline-safe). The same file uploads to the existing endpoint as *backup*; rows converge by dedupHash (superseded local ids dropped). History shows unsynced imports with an "On-device" badge.
- **Local invoice analysis** (fixture-verified port) + offline draft composer with badged "Offline preview" fallback.
- Fixed a real find along the way: committed migrations had drifted from `schema.ts` (`owners.notes`, `assets.metadata` missing; stale `owners.type`); the new DB matches `schema.ts` exactly.

---

## 3. Privacy design: what lives where

| Data | On device (OPFS/IndexedDB) | Server (managed mode, coming soon) | Server (self-host today) |
|---|---|---|---|
| Transactions, descriptions, amounts, categories, owners, invoices | ✅ plaintext (queryable offline), sealed with DEK on lock | ✅ **ciphertext only** (`vault_blobs.cipher`) | Plaintext rows (you own the DB) |
| Vault DEK | Memory only, wiped on lock | ❌ never | n/a |
| Password / recovery code | Never stored (derived → wiped) | ❌ never | n/a (login password is auth-only, hashed) |
| Passkey / PRF output | Authenticator hardware; 32-B output in memory only | Credential-ID hint only (`prf_credential_id`) | n/a |
| Argon2 salt + params | In vault blob (not secret) | Same (not secret) | n/a |
| Account email (login identity) | — | Plaintext (routing + auth; unavoidable) | Plaintext |

**What the server operator (managed mode) can see:** an email address, an opaque blob, and its size/update time. No transactions, no categories, no balances, no keys. Correctness of this claim is checkable: `vault-e2e.mts` + `crypto.ts` are the entire trusted client path, and the API has no decrypt code path at all.

**Threat model (explicit):**
- ✅ Protects against: curious host, DB breach/backup leak, passive network observer, device theft while locked.
- ⚠️ Does NOT protect against: compromised client bundle (you must trust the served JS — mitigate with reproducible builds + SRI later), unlocked-device access, malware/keyloggers, metadata (email, blob size, access times), forgotten password + lost recovery code + lost passkey (unrecoverable **by design**).

---

## 4. Why this is beneficial (beyond "encryption")

1. **Blast-radius reduction.** A server breach yields ciphertext with 128–256-bit keys, not CSVs of people's lives. Backups inherit the same property for free.
2. **Offline is a side effect of privacy.** Parsing, analytics, invoices, and search run without network — the product works on planes, and latency disappears.
3. **Sync without trust.** dedupHash doubles as the idempotency key, so backup upload is naturally convergent; multi-device and future Android/iOS reuse the same envelope (noble/hash-wasm run on React Native; the Rust core, if ever needed, only re-implements parse/categorize).
4. **No plaintext migrations.** Once the managed service launches, no datasegregation work is needed — the privacy property is structural, not policy-based.
5. **Auditable surface.** All privacy-critical code is ~1.5k lines across `local-engine/src/crypto.ts`, `webauthn-prf.ts`, `vault-sync.ts`, `routes/vault.ts`. Everything else can be compromised without leaking content.

---

## 5. Deliberately NOT done (honest backlog)

- **Managed zero-knowledge service** — coming soon. Code-complete client + API, no production deployment, no billing/multi-device conflict UI yet.
- **Page-level encryption** — OPFS file is sealed at rest, but live pages are plaintext SQLite. Verified path: custom wa-sqlite + SQLite3MC build (`PRAGMA key`), ~885 KB, no COOP/COEP. Needs an emscripten build step we didn't want to rush.
- **Offline invoice/transaction editing** — reads work offline; writes still go through the server when online (operation log + conflict resolution outstanding).
- **Key rotation UX** (re-wrap flows exist as primitives, no UI), **SRI/pinned client builds**, **third-party audit**.

---

## 6. How to verify (for reviewers)

```bash
# Crypto suite (wrap/unwrap, wrong-key + tamper rejection, envelope)
# SQL builders vs real SQLite  •  invoice parity fixture
pnpm --filter @momoney/local-engine build   # then run the *-check scripts
# Opaque-store E2E (needs API on :3001 + momoney_db_secure)
cd apps/api && tsx ./vault-e2e.mts          # expect E2E PASS
# Manual: /settings/vault → create → lock → confirm OPFS holds .sealed only
```

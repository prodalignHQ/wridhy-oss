# DONE 001: Local-First Encrypted-Vault Architecture (Phases 1–3)

**Date:** 2026-09-27
**Status:** Shipped on `super-secure` (`289e0dc` → `d885efc`)
**Category:** Architecture / Privacy / Local-first
**Tags:** `#privacy` `#local-first` `#argon2id` `#xchacha20` `#webauthn-prf` `#opfs` `#wa-sqlite` `#zero-knowledge`

> **How to read this doc:** every section keeps the full technical detail, followed by a
> 🧠 **ELI5** box that explains the same idea for a newcomer. If you're a noob dev, just read
> the ELI5 boxes first — you'll get 80% of the design. Then re-read the technical parts and
> they'll click. A jargon glossary lives at the bottom (§7).

---

## 1. The problem

MoMoney stored transaction data as **plaintext rows in PostgreSQL** (`transactions.description`, `merchant`, `amount`, …). Parsing (`@momoney/parsers`), categorization, and all analytics (`InsightsService`, invoice `buildAnalysis`) ran **server-side**. Consequences:

- Anyone with database access (host, backup, breach) reads every transaction.
- The hosted/managed story was unshippable for a privacy product: syncing across devices meant trusting the server with plaintext.
- Mobile (Android/iOS) would inherit the same trust problem.

Goal: move compute to the device, encrypt everything that leaves it, and reduce the server to an **opaque, zero-knowledge blob store** — while keeping the product fully usable offline.

> 🧠 **ELI5:** Imagine every bank statement you upload is written on a **postcard** and mailed to our
> office, where we read it, sort it, and file it in an open cabinet. Anyone who walks into the office
> (or steals the cabinet) can read your postcards. That's how most finance apps work — and how MoMoney
> used to work. Our goal: **do all the reading and sorting at your kitchen table**, and if anything must
> be mailed to us for safekeeping, put it in a **locked safe to which only you hold the key**. We store
> the safe. We can never open it. And your kitchen table works fine even when the post office is closed
> (offline).

> **Scope note:** the managed zero-knowledge sync service this unlocks is **coming soon** (no production deployment yet). Today's shippable modes are self-host (your server, your DB) and the standalone offline binary. Everything below is built, tested, and live in code behind those modes.

---

## 2. What changed (Phase 1 → 3)

### Phase 1 — parsers + analytics move to the device (`289e0dc`)

- **New `@momoney/local-engine`**: isomorphic dedup (`computeDedupHashBrowser`, SubtleCrypto SHA-256, byte-identical to the server's `createHash` — verified), and an in-memory port of `InsightsService` (monthly/yearly/category-comparison/averages) plus invoice `buildAnalysis`.
- **Parsers run in the browser**: extracted the pure ICICI-PDF line parser shared by server (`pdf-parse`) and browser (`pdfjs-dist`); CSV/XLS via `papaparse`/`xlsx` already browser-safe. Statement preview runs in a **Web Worker** with server fallback.
- **Packaging lessons** (Turbopack): workspace packages with NodeNext `.js`-suffix TS sources don't resolve in the client — `parsers`/`rules-engine`/`local-engine` now build to `dist/`; `parsers` gained a `src/browser.ts` entry excluding `pdf-parse`; xlsx is consumed via named imports + a lazy SSF loader (static `import { SSF }` breaks Node CJS-lexer; `.default` access breaks Turbopack).

> 🧠 **ELI5 — the ideas in this phase:**
> - **"Move compute to the device"** means: instead of sending your bank file to our computer to be read, your *own* phone/laptop reads it. The code that reads it is the same code — we just run it in your browser instead of on our server.
> - **Isomorphic** = "same code, runs everywhere." We write the money-math once and run it in the browser, on the server, and (later) on phones. One recipe, many kitchens.
> - **Dedup / hash:** re-uploading the same statement must not duplicate your transactions. So each transaction gets a **fingerprint** (a SHA-256 hash of account + date + amount + description). Same fingerprint = same transaction = skip it. Think of it like a barcode: scan it twice, count it once.
> - **Web Worker:** browsers have one main "thinking thread" for the visible page. A Worker is a **back room** where heavy work (reading a 5 MB Excel file) happens without freezing what you see. Same building, separate room.
> - **The `dist/` and import gymnastics:** TypeScript needs compiling before browsers can run it, and two tools (Node on the server, Turbopack in the browser) disagree about *how files find each other*. We hit three paper cuts (file-extension styles, a Node-only PDF library sneaking into browser code, two ways of importing Excel helpers) and fixed each by giving the browser its own clean entry point. Lesson for juniors: **half of "browser compat" work is just import hygiene.**

### Phase 2 — encrypted vault + WebAuthn PRF + OPFS (`1d580dc`)

- **Key hierarchy (client-only):** `password → Argon2id(salt) → KEK`, 32-byte random **DEK**, `XChaCha20-Poly1305` snapshot envelope; DEK wrapped by password-KEK, **WebAuthn PRF output**, and recovery-code-KEK (secretbox wraps). Primitives: hash-wasm + `@noble/ciphers` (libsodium-wrappers 0.7.16's ESM entry was found broken; noble is ESM-native and Worker-safe).
- **Server is opaque:** `vault_blobs` (one row/user) holds base64 ciphertext + wrap metadata only. `GET|PUT|DELETE /v1/vault` never decrypts. E2E-tested (`apps/api/vault-e2e.mts`): signup → PUT → GET byte-identical → client decrypt → DELETE → `NO_VAULT`.
- **OPFS database:** wa-sqlite sync build + `OriginPrivateFileSystemVFS` in a dedicated Worker (`wa-sqlite.wasm` vendored). Lock seals `momoney.db` → `momoney.db.sealed` with the DEK; unlock unseals. DEK lives in memory only, wiped on lock.
- **UI:** `/settings/vault` (setup, 3 unlock paths, sync, recovery code shown once).

> 🧠 **ELI5 — keys, locks, and safes:**
> - **DEK (Data Encryption Key):** a random 256-bit number your device invents. It's the **one physical key** that locks and unlocks your safe. Everything secret is locked with it.
> - **KEK (Key Encryption Key):** a key that locks *other keys*. Your password isn't used on the safe directly — instead we mathematically stretch it into a KEK, and the KEK wraps (locks) the DEK. Three different KEKs (password, passkey, recovery code) can each unwrap the same DEK — like **three different keys cut for the same lock**, so losing one doesn't lock you out.
> - **Argon2id** is the stretching machine: password in, 32-byte key out. It's deliberately slow and memory-hungry so thieves can't guess millions of passwords per second. The **salt** is just random seasoning mixed in so two people with password `123456` get different keys (salt isn't secret — it's stored openly).
> - **XChaCha20-Poly1305** is the safe itself: it scrambles your data *and* seals it so any tampering is detected (open a tampered safe and it refuses — that's the "Poly1305" authentication tag doing its job).
> - **secretbox** is a smaller safe used only for wrapping the DEK with each KEK.
> - **WebAuthn PRF / passkey:** your phone's secure chip can take an input and return 32 secret bytes, but *only* after you unlock it with your face/fingerprint. We use those 32 bytes as a KEK. Your biometric never leaves the chip — the phone just says "yes, it's really them" and hands over the bytes. That's why there's nothing to phish.
> - **OPFS** (Origin Private File System) is a **private drawer in the browser** where websites can keep real files (here: a real SQLite database). Only our app can open our drawer.
> - **SQLite/WASM:** SQLite is the world's most-used database (it runs on every phone). Browsers can't run its native code, so we use a version compiled to **WASM** (WebAssembly — native-speed code that browsers *can* run). wa-sqlite is the adapter that lets JavaScript talk to it.
> - **Sealing on lock:** when you tap Lock, we encrypt the whole database file with your DEK, save the scrambled version, delete the readable one, and **wipe the DEK from memory**. A locked device holds ciphertext, full stop.
> - **base64** is just a way to write random bytes using only safe keyboard characters, so encrypted blobs can travel inside normal JSON and database text columns.

### Phase 3 — OPFS write path + convergence (`d885efc`)

- Cache extended to **all reference tables** (accounts, owners, txn-owners, rules, merchants, invoices + statements/items). All SQL is shared via `local-engine/src/opfs-schema.ts` builders, executed against real SQLite in Node tests.
- **Local-first import:** parse → same `categorize()` call as the server → dedupHash → OPFS instantly (offline-safe). The same file uploads to the existing endpoint as *backup*; rows converge by dedupHash (superseded local ids dropped). History shows unsynced imports with an "On-device" badge.
- **Local invoice analysis** (fixture-verified port) + offline draft composer with badged "Offline preview" fallback.
- Fixed a real find along the way: committed migrations had drifted from `schema.ts` (`owners.notes`, `assets.metadata` missing; stale `owners.type`); the new DB matches `schema.ts` exactly.

> 🧠 **ELI5 — write locally, sync later:**
> - **Write path** = where new data goes *first*. Old flow: your file went to the server, the server did everything, the browser just displayed results. New flow: **your device does everything immediately** (parse, label, save), and the server gets a copy afterwards purely as backup.
> - **Convergence / idempotency:** the tricky bit — after backup, you have *two copies* of each transaction (a local one and a server one). Because both sides compute the **same fingerprint (dedupHash)**, the app can recognize "these two are the same transaction" and quietly keep the server copy. Uploading twice is safe because fingerprints make repeats recognizable. That property has a fancy name: **idempotency** — doing an operation twice has the same effect as doing it once (like pressing an elevator button repeatedly).
> - **Single source of SQL truth:** the browser database and our tests share one file that *builds* every SQL statement. If someone changes a table, both sides change together — they can't drift apart. (We learned this the hard way: the old server migrations had silently drifted from the schema, and Phase 3 caught it.)
> - **"On-device" badge** in the UI is honesty engineering: it tells you "this import lives only on this device so far — the backup hasn't landed yet."

---

## 3. Privacy design: what lives where

> 🧠 **ELI5:** this table answers one question six ways: **"if someone broke into that computer, what would they actually see?"** Column 2 = a thief with your *locked* phone. Column 3 = a thief who breaks into *our* future sync servers. Column 4 = today, where you run the server yourself (so "the thief" would be breaking into your own house).

| Data | On device (OPFS/IndexedDB) | Server (managed mode, coming soon) | Server (self-host today) |
|---|---|---|---|
| Transactions, descriptions, amounts, categories, owners, invoices | ✅ plaintext (queryable offline), sealed with DEK on lock | ✅ **ciphertext only** (`vault_blobs.cipher`) | Plaintext rows (you own the DB) |
| Vault DEK | Memory only, wiped on lock | ❌ never | n/a |
| Password / recovery code | Never stored (derived → wiped) | ❌ never | n/a (login password is auth-only, hashed) |
| Passkey / PRF output | Authenticator hardware; 32-B output in memory only | Credential-ID hint only (`prf_credential_id`) | n/a |
| Argon2 salt + params | In vault blob (not secret) | Same (not secret) | n/a |
| Account email (login identity) | — | Plaintext (routing + auth; unavoidable) | Plaintext |

**What the server operator (managed mode) can see:** an email address, an opaque blob, and its size/update time. No transactions, no categories, no balances, no keys. Correctness of this claim is checkable: `vault-e2e.mts` + `crypto.ts` are the entire trusted client path, and the API has no decrypt code path at all.

> 🧠 **ELI5:** "Opaque" means **we can hold the envelope but can't read the letter**. The strongest evidence isn't our promise — it's structural: *there is literally no code on the server that could decrypt your data even if we wanted to*. The decryption keys never leave your device, and the server never receives them. You don't have to trust our intentions; you can verify our code.

**Threat model (explicit):**
- ✅ Protects against: curious host, DB breach/backup leak, passive network observer, device theft while locked.
- ⚠️ Does NOT protect against: compromised client bundle (you must trust the served JS — mitigate with reproducible builds + SRI later), unlocked-device access, malware/keyloggers, metadata (email, blob size, access times), forgotten password + lost recovery code + lost passkey (unrecoverable **by design**).

> 🧠 **ELI5 — what "threat model" means:** it's a written list of *which burglars we've locked out, and which we haven't*. Be suspicious of any privacy product that won't show you this list. Ours says: we defeat the nosy hosting company, the hacker who steals our database, the eavesdropper on your Wi-Fi, and the thief who steals your *locked* phone. We do **not** defeat: a virus already on your phone, someone looking over your shoulder at your *unlocked* phone, or you losing every key at once (we can't rescue you — that's the price of us never having the key). The metadata caveat means: we can see *that* you backed up 2 MB on Tuesday, just never *what's inside*.

---

## 4. Why this is beneficial (beyond "encryption")

1. **Blast-radius reduction.** A server breach yields ciphertext with 128–256-bit keys, not CSVs of people's lives. Backups inherit the same property for free.
   > 🧠 *If the office burns down, the thieves get locked safes, not open filing cabinets — and so do the backup copies in the warehouse.*
2. **Offline is a side effect of privacy.** Parsing, analytics, invoices, and search run without network — the product works on planes, and latency disappears.
   > 🧠 *Because your kitchen table does all the work, you stop caring whether the post office is open. Privacy architecture accidentally made the app faster and more reliable.*
3. **Sync without trust.** dedupHash doubles as the idempotency key, so backup upload is naturally convergent; multi-device and future Android/iOS reuse the same envelope (noble/hash-wasm run on React Native; the Rust core, if ever needed, only re-implements parse/categorize).
   > 🧠 *The fingerprint trick means "upload again to be safe" can never create duplicates — which is exactly what makes painless multi-device sync possible later without redesigning anything.*
4. **No plaintext migrations.** Once the managed service launches, no datasegregation work is needed — the privacy property is structural, not policy-based.
   > 🧠 *Most companies' privacy is a* policy *("we promise to be careful") that every new feature can accidentally break. Ours is* architecture *("the server physically cannot see it") — new features inherit it automatically.*
5. **Auditable surface.** All privacy-critical code is ~1.5k lines across `local-engine/src/crypto.ts`, `webauthn-prf.ts`, `vault-sync.ts`, `routes/vault.ts`. Everything else can be compromised without leaking content.
   > 🧠 *You don't need to audit a whole city — just the bank vault building. We deliberately squeezed every secret-touching line into four small files you (or a hired auditor) can actually read in an afternoon.*

---

## 5. Deliberately NOT done (honest backlog)

- **Managed zero-knowledge service** — coming soon. Code-complete client + API, no production deployment, no billing/multi-device conflict UI yet.
- **Page-level encryption** — OPFS file is sealed at rest, but live pages are plaintext SQLite. Verified path: custom wa-sqlite + SQLite3MC build (`PRAGMA key`), ~885 KB, no COOP/COEP. Needs an emscripten build step we didn't want to rush.
- **Offline invoice/transaction editing** — reads work offline; writes still go through the server when online (operation log + conflict resolution outstanding).
- **Key rotation UX** (re-wrap flows exist as primitives, no UI), **SRI/pinned client builds**, **third-party audit**.

> 🧠 **ELI5 — reading this list correctly:**
> - *Managed service:* the safes are built and tested; we just haven't opened the storage business yet.
> - *Page-level encryption:* today we lock the **whole filing cabinet** when you leave. The upgrade is locking **every drawer individually**, so even while you're working, a thief grabbing one drawer gets gibberish. We know exactly how to build it; it needs a special compiler toolchain we didn't want to rush.
> - *Offline editing:* you can *read* everything offline, but *changing* things still needs the server for now (merging conflicting edits from two devices is genuinely hard — it's the last big problem).
> - *SRI / reproducible builds:* technical seals proving the website code you received is byte-for-byte the code we published — closing the "compromised website" hole in the threat model.
> - *Third-party audit:* paying professional burglars (security researchers) to try to break in. The code is auditor-ready; the audit itself is budgeted, not done.

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

> 🧠 **ELI5:** don't take our word for any of this — that's the whole point. These three checks let you *prove* it: (1) run the crypto tests and watch wrong passwords and tampered data get rejected; (2) run the end-to-end script and watch the server store and return bytes it cannot read; (3) lock your vault in the app and inspect the browser's private drawer yourself — you'll find only a `.sealed` file of gibberish where your database used to be.

---

## 7. Jargon glossary (for the noob dev)

| Word | One-line meaning | Where we use it |
|---|---|---|
| Plaintext / ciphertext | Readable vs scrambled data | DB rows vs vault blobs |
| Hash / fingerprint | One-way ID computed from data (can't be reversed) | dedupHash, SHA-256 |
| Salt | Random seasoning so identical passwords get different keys (public, not secret) | Argon2, stored in vault blob |
| KEK / DEK | Key-Encrypting-Key (locks keys) / Data-Encryption-Key (locks data) | `crypto.ts` hierarchy |
| Argon2id | Slow, memory-hungry password→key function; resists guessing | Password & recovery KEKs |
| XChaCha20-Poly1305 | Scrambles data + detects tampering | Snapshot envelope, file seal |
| secretbox (XSalsa20-Poly1305) | Smaller authenticated lockbox | Wrapping the DEK |
| Passkey / WebAuthn PRF | Phone-secure-chip login that can also output secret bytes | Passwordless vault unlock |
| OPFS | Browser's private file drawer | On-device SQLite file |
| SQLite / WASM / wa-sqlite | Tiny database / browser-runnable native code / the adapter between them | `db.worker.ts` |
| Web Worker | Background thread so heavy work never freezes the page | Parser + DB workers |
| Isomorphic | Same code running on server, browser, (later) phones | `local-engine`, `rules-engine` |
| Idempotency | Repeating an action is safe (dedup by fingerprint) | Backup upload, convergence |
| base64 / base64url | Bytes written as safe text characters | All API crypto fields |
| Canonical JSON | Same data → byte-identical text (sorted keys) | Deterministic envelopes |
| Opaque / zero-knowledge | Server holds data it cannot read | `vault_blobs`, `/v1/vault` |
| Threat model | Written list of which attackers you defeat (and don't) | §3 above |
| SRI | Seal proving served JS matches published JS | Future work |
| Emscripten | Compiler that turns C (SQLite) into browser code | Future SMC build |
| COOP/COEP | Browser security headers some tech needs (we avoid needing them) | VFS choice |

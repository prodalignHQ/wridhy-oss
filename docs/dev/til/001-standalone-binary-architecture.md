# TIL 001: Standalone Single-Binary Architecture (`standalone.ts`)

**Date:** 2026-09-26  
**Category:** Architecture / Distribution / Bun  
**Tags:** `#bun` `#sqlite` `#hono` `#nextjs` `#single-binary` `#offline-first`

---

## The Problem

In standard web development, MoMoney runs as a multi-tier client/server setup:
1. **Frontend:** Next.js 16 dev/production server on port `3000`.
2. **Backend:** Hono REST API server on port `3001`.
3. **Database:** PostgreSQL running in a Docker container on port `5432`.
4. **Auth & Networking:** Cross-Origin Resource Sharing (CORS), separate cookies, SMTP email verification for signup.

While this architecture is ideal for a multi-tenant commercial SaaS product, it presents significant friction for a **privacy-first personal finance tool** aimed at non-tech users. Non-tech users cannot be expected to install Docker, Node.js, pnpm, configure `.env` files, or run command-line database migrations.

---

## The Solution

We created a self-contained, single-binary distribution using **Bun** (`bun build --compile`) that packs the entire application into a single executable (~61 MB) with embedded SQLite.

The orchestrator for this setup is [`apps/api/src/standalone.ts`](file:///Users/rohanmallya/Development/prodalign/momoney/apps/api/src/standalone.ts).

```
┌─────────────────────────────────────────────────────────────┐
│                    Standalone Binary (momoney)              │
│                                                             │
│   ┌──────────────────────┐      ┌───────────────────────┐   │
│   │ Embedded Next.js App │      │ Hono REST API         │   │
│   │ (HTML / CSS / JS)    │      │ (/v1/*, /api/auth/*)  │   │
│   └──────────┬───────────┘      └───────────┬───────────┘   │
│              │                              │               │
│              └──────────────┬───────────────┘               │
│                             │                               │
│                   Bun.serve(:3000)                          │
│                             │                               │
│                             ▼                               │
│                 Native SQLite (bun:sqlite)                  │
│                 ~/.momoney/momoney.db                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Responsibilities of `standalone.ts`

### 1. Database & Local User Bootstrapping
Before handling any incoming traffic, `standalone.ts` calls `ensureLocalUserAndSeed()`:
- Automatically creates `~/.momoney/momoney.db` if it does not exist.
- Enables WAL (Write-Ahead Logging) mode and foreign keys (`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`).
- Auto-provisions a default `Local User` (`00000000-0000-0000-0000-000000000001`) and default `Self` owner.
- Seeds all 12 system categories with default icons and colors.
- Users bypass the signup and email verification hurdles completely.

### 2. Single-Port Unified Serving (Zero CORS)
Instead of running Next.js on port 3000 and Hono on port 3001:
- Static Next.js assets are exported via `NEXT_OUTPUT_EXPORT=true next build`.
- [`scripts/bundle-assets.ts`](file:///Users/rohanmallya/Development/prodalign/momoney/scripts/bundle-assets.ts) compresses and encodes all 229 static files into memory as pre-gzipped buffers.
- `standalone.ts` serves:
  - `/v1/*` ➔ MoMoney REST API
  - `/api/auth/*` ➔ Local session & auth endpoints
  - `/*` ➔ Embedded static HTML/CSS/JS with `Content-Encoding: gzip`
- Because the frontend and backend share the exact same origin (`http://localhost:3000`), CORS headers and domain cookie mismatches are entirely eliminated.

### 3. Port Conflict Detection & Browser Auto-Launch
- Attempts to bind to port `3000`. If occupied by another process, it automatically increments (`3001`, `3002`, etc.) until a free port is found.
- Uses OS-level commands (`open` on macOS, `xdg-open` on Linux, `start` on Windows) to automatically open the dashboard in the user's default browser as soon as the server is ready.

---

## Build Commands

```bash
# Build the binary for current OS
pnpm run build:binary

# Cross-compile for macOS, Linux, and Windows from one machine
pnpm run build:binary:all
```

---

## Key Takeaways

1. **Retain Hosted vs Local Separation:** The standard production entry point ([`apps/api/src/index.ts`](file:///Users/rohanmallya/Development/prodalign/momoney/apps/api/src/index.ts)) remains untouched for the commercial PostgreSQL cloud deployment. `standalone.ts` serves purely as the single-binary standalone entry point.
2. **Pre-Gzipped In-Memory Assets:** Gzipping static assets at build time and serving them with `Content-Encoding: gzip` reduces asset footprint in the binary from 6.2MB to ~2.2MB while eliminating runtime compression overhead.

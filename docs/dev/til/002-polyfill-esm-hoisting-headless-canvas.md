# TIL 002: ESM Import Hoisting & Headless Canvas Polyfills (`polyfill.ts`)

**Date:** 2026-09-26  
**Category:** JavaScript / Bun / Runtime  
**Tags:** `#esm` `#hoisting` `#pdf-parse` `#canvas` `#polyfills` `#bun-compile`

---

## The Problem

When compiling the MoMoney backend and bank statement parsers into a standalone binary using Bun (`bun build --compile`), two subtle but fatal runtime bugs surfaced immediately upon startup:

### Bug 1: `ReferenceError: DOMMatrix is not defined`
The bank statement parser library (`pdf-parse`) depends on Mozilla's `pdfjs-dist`. In a browser, DOM matrix objects (`DOMMatrix`, `Path2D`, `ImageData`) are provided by the browser window/canvas. In a headless server runtime, `pdfjs-dist` attempts to load `@napi-rs/canvas`.

In a compiled standalone Bun executable:
- Native C++ Node-API bindings (`.node` files like `@napi-rs/canvas`) cannot be bundled cleanly across cross-compilation targets.
- Without canvas installed, `pdfjs-dist` executes:
  ```js
  var SCALE_MATRIX = new DOMMatrix();
  ```
  at module load time, causing an immediate fatal crash:
  ```text
  ReferenceError: DOMMatrix is not defined
  ```

### Bug 2: ESM Hoisting Bypassing Environment Variables
To force the standalone binary into SQLite mode, we initially set:
```ts
// apps/api/src/standalone.ts
import { createApiApp } from './app.js'

process.env['DB_DIALECT'] = 'sqlite'
process.env['MOMONEY_LOCAL_MODE'] = 'true'
```
However, the application still attempted to connect to PostgreSQL and crashed with:
```text
PostgresError: invalid input syntax for type uuid: "00000000-0000-0000-0000-000000000001"
```

**Why did this happen?**
In ECMAScript Modules (ESM), **all `import` declarations are hoisted and evaluated before any top-level executable code runs**.
- `import { createApiApp } from './app.js'` ran first.
- `app.js` imported all route modules.
- Route modules imported `@momoney/db`.
- `@momoney/db` evaluated its top-level `isSqlite` check while `process.env['DB_DIALECT']` was still `undefined`.
- Because `.env` contained `DATABASE_URL=postgres://...`, `@momoney/db` initialized the PostgreSQL driver!

---

## The Solution: Dedicated First-Import Polyfill (`polyfill.ts`)

To solve both issues in one clean place, we created [`apps/api/src/polyfill.ts`](file:///Users/rohanmallya/Development/prodalign/momoney/apps/api/src/polyfill.ts) and imported it as **line 1** in `standalone.ts`:

```ts
// apps/api/src/standalone.ts
import './polyfill.js' // MUST be the first import!
import { createApiApp } from './app.js'
...
```

### What `polyfill.ts` Does:

```ts
// apps/api/src/polyfill.ts

// 1. Headless Canvas Polyfills for pdfjs-dist
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
  }
}
if (typeof (globalThis as any).Path2D === 'undefined') {
  ;(globalThis as any).Path2D = class Path2D {}
}
if (typeof (globalThis as any).ImageData === 'undefined') {
  ;(globalThis as any).ImageData = class ImageData {}
}

// 2. Standalone Environment Enforcement
process.env['DB_DIALECT'] = 'sqlite'
process.env['MOMONEY_LOCAL_MODE'] = 'true'
if (!process.env['BETTER_AUTH_SECRET']) {
  process.env['BETTER_AUTH_SECRET'] = 'momoney-local-secret-standalone-build-key'
}
```

---

## Why This Works

1. **Deterministic Execution Order:** Because `import './polyfill.js'` is the very first import statement in the entry file, JavaScript engine specifications guarantee that the side-effects in `polyfill.ts` execute **before** any subsequent imported module (including `app.js`, routes, `@momoney/db`, or `pdf-parse`) is evaluated.
2. **Lightweight Canvas Emulation:** For text extraction from bank statements, `pdf-parse` does not actually perform pixel-level canvas rasterization; it merely needs the transformation matrix stubs to not throw `ReferenceError` during module initialization.
3. **Guaranteed SQLite Selection:** When `@momoney/db/src/index.ts` evaluates, `process.env['DB_DIALECT']` is guaranteed to be `'sqlite'`, correctly binding the `bun:sqlite` driver and SQLite schema instead of PostgreSQL.

---

## Key Takeaways

1. **Beware of ESM Hoisting with `process.env`:** Never rely on setting `process.env` in the body of a file that imports modules depending on those variables. Always use a dedicated pre-import module (e.g., `import './env.js'` or `import './polyfill.js'`).
2. **Stub Before Heavy Native Dependencies:** Before pulling in heavy native C++ binary modules (like `@napi-rs/canvas`) that break cross-compilation, test whether minimal JavaScript class stubs on `globalThis` satisfy the library's runtime requirements.

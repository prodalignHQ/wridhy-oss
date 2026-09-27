# 02 — Browser-safe parsers

Goal: all 4 bank parsers run on-device. Blockers were all import/bundler issues, not logic.

## Changed files

- **`banks/icici-savings-pdf.lines.ts`** (new): pure `parseIciciPdfLines(lines)` — balance-reconciliation debit/credit inference, multi-line descriptions, B/F opening handling. Zero deps; shared by server (`pdf-parse`) and browser (`pdfjs-dist`).
- **`banks/icici-savings-pdf.parser.ts`**: gutted to `PDFParse → split → parseIciciPdfLines` (behavior preserved, verified by fixture).
- **`src/browser.ts`** (new): browser-safe entry — CSV/XLS/credit/HDFC parsers + `parseIciciPdfLines`, **excluding** the Node-only `pdf-parse` strategy. Web imports `@momoney/parsers/browser`.
- **`src/index.ts`**: also exports the granular CSV/XLS parsers (the web orchestrator calls non-PDF strategies directly).
- **`xlsx-ssf.ts`** (new): lazy `loadXlsxSSF()` — static `import { SSF }` breaks Node's CJS lexer (xlsx.js hides it); `(ns as any).default` breaks Turbopack. Dynamic import works in both; HDFC parsers went `async` (interface already allowed `Promise`) and take `ssf` as a param.
- **HDFC + ICICI-XLS parsers**: `import * as XLSX` → named `read`/`utils` imports (namespace `.default` access broke the Turbopack client build). Verified by XLSX round-trip test in Node.

## Packaging rules (load-bearing, in `package.json`)

- `parsers` / `rules-engine` / `local-engine` build to `dist/`; web + API consume `dist`, never `src` (Turbopack cannot resolve NodeNext `.js`-suffix TS sources).
- `dev` scripts run `tsc && tsc --watch` so `turbo dev` keeps `dist/` fresh.
- `docs/customization/parsers.md` documents the browser-compatibility constraints for future parser authors.

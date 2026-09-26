// ─── Browser-safe entry point ───────────────────────────────────────────────
// Excludes the Node-only `pdf-parse` strategy (see icici-savings-pdf.parser.ts).
// Browser PDF text extraction lives in apps/web/lib/engine/pdf.ts (pdfjs-dist)
// and feeds the shared isomorphic parseIciciPdfLines() below.

export type { ParsedTransaction, BankParser } from './base.parser.js'
export { iciciSavingsCsvParser } from './banks/icici-savings-csv.parser.js'
export { iciciSavingsXlsParser } from './banks/icici-savings-xls.parser.js'
export { iciciCreditParser } from './banks/icici-credit.parser.js'
export { hdfcSavingsParser } from './banks/hdfc-savings.parser.js'
export { hdfcCreditParser } from './banks/hdfc-credit.parser.js'
export { parseIciciPdfLines } from './banks/icici-savings-pdf.lines.js'

// ─── Local parse orchestrator (main-thread path) ────────────────────────────
// Browser-safe: xlsx + papaparse run in-browser already; PDF goes through
// pdfjs-dist (see pdf.ts). Mirrors the server composite strategy in
// packages/parsers/src/banks/icici-savings.parser.ts, minus the Node-only
// pdf-parse strategy.

import {
  hdfcCreditParser,
  hdfcSavingsParser,
  iciciCreditParser,
  iciciSavingsCsvParser,
  iciciSavingsXlsParser,
  parseIciciPdfLines,
  type ParsedTransaction,
} from '@momoney/parsers/browser'
import { parsePdfBufferBrowser } from './pdf'

async function parseIciciSavingsBrowser(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
  const head = new TextDecoder().decode(buffer.slice(0, 5))
  if (head.startsWith('%PDF')) {
    try {
      const txns = await parsePdfBufferBrowser(buffer.slice(0))
      if (txns.length > 0) return txns
    } catch (err) {
      console.warn('[local-engine] browser PDF parse failed, falling back', err)
    }
    return []
  }
  // Non-PDF: try CSV then XLS (same order as server composite, minus PDF).
  for (const strategy of [iciciSavingsCsvParser, iciciSavingsXlsParser]) {
    try {
      const out = await strategy.parse(buffer.slice(0))
      if (out.length > 0) return out
    } catch {
      // try next
    }
  }
  // Last resort: shared line parser over raw text (handles PDFs saved as text).
  try {
    const text = new TextDecoder().decode(buffer.slice(0))
    const out = parseIciciPdfLines(text.split('\n'))
    if (out.length > 0) return out
  } catch {
    // ignore
  }
  return []
}

export interface LocalPreviewRow {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

/** Parse a statement file entirely in-browser. Never throws on partial parse. */
export async function parseStatementLocal(bankId: string, buffer: ArrayBuffer): Promise<LocalPreviewRow[]> {
  let txns: ParsedTransaction[] = []
  if (bankId === 'icici_savings') {
    txns = await parseIciciSavingsBrowser(buffer)
  } else if (bankId === 'icici_credit') {
    txns = await iciciCreditParser.parse(buffer)
  } else if (bankId === 'hdfc_savings') {
    txns = await hdfcSavingsParser.parse(buffer)
  } else if (bankId === 'hdfc_credit') {
    txns = await hdfcCreditParser.parse(buffer)
  } else {
    throw new Error(`No local parser for bankId "${bankId}"`)
  }
  return txns.map((t) => ({
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    type: t.type,
  }))
}

export { parsePdfBufferBrowser }

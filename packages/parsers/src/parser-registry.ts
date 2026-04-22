import type { BankParser } from './base.parser'
import { iciciSavingsParser } from './banks/icici-savings.parser'
import { iciciCreditParser } from './banks/icici-credit.parser'

// ─── Registry ────────────────────────────────────────────────────────────────

const parsers: BankParser[] = [
  iciciSavingsParser,
  iciciCreditParser,
]

const registry = new Map<string, BankParser>(
  parsers.map((p) => [p.bankId, p])
)

/**
 * Get the parser for a given bankId.
 * Returns undefined if no parser is registered for that bankId.
 */
export function getParser(bankId: string): BankParser | undefined {
  return registry.get(bankId)
}

/**
 * List all registered parsers (for populating the bank selector UI).
 */
export function listParsers(): Array<{ bankId: string; displayName: string }> {
  return parsers.map(({ bankId, displayName }) => ({ bankId, displayName }))
}

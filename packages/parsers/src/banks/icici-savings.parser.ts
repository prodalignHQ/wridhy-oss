import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { iciciSavingsCsvParser } from './icici-savings-csv.parser.js'
import { iciciSavingsXlsParser } from './icici-savings-xls.parser.js'

/**
 * Composite ICICI Bank Savings Account Statement Parser
 *
 * This parser delegates to specific implementations for CSV and legacy XLS formats.
 * It will attempt each strategy in sequence and return the successfully extracted transactions.
 */
export const iciciSavingsParser: BankParser = {
  bankId: 'icici_savings',
  displayName: 'ICICI Bank Savings Account',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    const strategies = [iciciSavingsCsvParser, iciciSavingsXlsParser]

    for (const strategy of strategies) {
      try {
        const results = strategy.parse(buffer)
        if (results.length > 0) {
          return results
        }
      } catch (error) {
        // Suppress parsing errors for specific strategies to ensure fallback occurs
        console.warn(`[Parsers] Strategy ${strategy.bankId} failed to parse buffer. Falling back to next.`)
      }
    }

    // Return empty if all strategies fail or yield zero transactions
    return []
  },
}

import type { BankParser, ParsedTransaction } from '../base.parser'
import { iciciSavingsCsvParser } from './icici-savings-csv.parser'
import { iciciSavingsPdfParser } from './icici-savings-pdf.parser'
import { iciciSavingsXlsParser } from './icici-savings-xls.parser'

/**
 * Composite ICICI Bank Savings Account Statement Parser
 *
 * This parser delegates to specific implementations for CSV and legacy XLS formats.
 * It will attempt each strategy in sequence and return the successfully extracted transactions.
 */
export const iciciSavingsParser: BankParser = {
  bankId: 'icici_savings',
  displayName: 'ICICI Bank Savings Account',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    console.log("Parsing")
    const strategies = [iciciSavingsPdfParser, iciciSavingsCsvParser, iciciSavingsXlsParser]

    for (const strategy of strategies) {
      console.log("Trying: ", strategy.bankId)

      try {
        // Create a copy of the buffer because some parsers (like PDF) might detach the ArrayBuffer
        const bufferCopy = buffer.slice(0)
        const results = await strategy.parse(bufferCopy)
        if (results.length > 0) {
          console.log("Successful with strategy: ", strategy.bankId)
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

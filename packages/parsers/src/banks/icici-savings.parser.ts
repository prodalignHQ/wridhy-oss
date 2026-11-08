import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { createParserLogger } from '../logger.js'
import { iciciSavingsCsvParser } from './icici-savings-csv.parser.js'
import { iciciSavingsPdfParser } from './icici-savings-pdf.parser.js'
import { iciciSavingsXlsParser } from './icici-savings-xls.parser.js'

const log = createParserLogger('icici_savings')

/**
 * Composite ICICI Bank Savings Account Statement Parser
 *
 * This parser delegates to specific implementations for PDF, CSV, and legacy XLS formats.
 * It will attempt each strategy in sequence and return the successfully extracted transactions.
 */
export const iciciSavingsParser: BankParser = {
  bankId: 'icici_savings',
  displayName: 'ICICI Bank Savings Account',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    log.debug(`Starting parse on buffer of size ${buffer.byteLength} bytes`)
    const strategies = [iciciSavingsPdfParser, iciciSavingsCsvParser, iciciSavingsXlsParser]

    for (const strategy of strategies) {
      log.debug(`Attempting strategy: ${strategy.bankId}`)

      try {
        // Create a copy of the buffer because some parsers (like PDF) might detach the ArrayBuffer
        const bufferCopy = buffer.slice(0)
        const results = await strategy.parse(bufferCopy)
        if (results.length > 0) {
          log.debug(`Strategy ${strategy.bankId} succeeded with ${results.length} transactions`)
          return results
        }
        log.debug(`Strategy ${strategy.bankId} yielded 0 transactions. Falling back to next.`)
      } catch (error) {
        log.warn(`Strategy ${strategy.bankId} failed with error:`, error)
      }
    }

    log.warn(
      `All strategies [${strategies.map((s) => s.bankId).join(', ')}] failed to parse buffer. Returning 0 transactions.`
    )
    return []
  },
}


import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { createParserLogger } from '../logger.js'

const log = createParserLogger('icici_credit')

/**
 * ICICI Bank Credit Card Statement Parser
 *
 * Format: CSV
 * Structure:
 *   Row 1:  "Accountno:", "<number>"
 *   Row 2:  "Customer Name:", "<name>"
 *   Row 3:  "Address:", "<address>"
 *   Rows 4-5: blank
 *   Row 6:  "Transaction Details:"
 *   Row 7:  column headers — Date, Sr.No., Transaction Details, Reward Point Header, Intl.Amount, Amount(in Rs), BillingAmountSign
 *   Row 8:  card mask number (e.g. "4315XXXXXXXX8012")
 *   Rows 9+: actual transactions
 *
 * Sign convention:
 *   - BillingAmountSign = ""   → debit (you spent money)
 *   - BillingAmountSign = "CR" → credit (payment / refund)
 *
 * Date format: "DD/MM/YYYY"
 */
export const iciciCreditParser: BankParser = {
  bankId: 'icici_credit',
  displayName: 'ICICI Bank Credit Card',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    log.debug(`Starting parse on buffer of size ${buffer.byteLength} bytes`)

    try {
      // Decode the buffer to a UTF-8 string
      const text = new TextDecoder('utf-8').decode(buffer)

      const { data: rawRows, errors } = Papa.parse<string[]>(text, {
        skipEmptyLines: false,
      })

      if (errors && errors.length > 0) {
        log.warn('Papa.parse reported errors while reading ICICI credit card CSV:', errors)
      }

      log.debug(`Parsed ${rawRows.length} raw rows from CSV`)
      const results: ParsedTransaction[] = []
      let skippedShortRows = 0
      let skippedDateMismatch = 0
      let skippedZeroAmount = 0

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]!
        // Each cell may be quoted; papaparse already strips the quotes.
        if (row.length < 7) {
          skippedShortRows++
          continue
        }

        const dateStr = row[0]?.trim() ?? ''
        // Only process rows where column 0 matches DD/MM/YYYY
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          if (dateStr && skippedDateMismatch < 5) {
            log.debug(`Row ${i} non-matching date string "${dateStr}":`, row)
          }
          skippedDateMismatch++
          continue
        }

        const referenceNo = row[1]?.trim()
        const description = row[2]?.trim() ?? ''
        const amountRaw = row[5]?.trim() ?? ''
        const signRaw = row[6]?.trim() ?? ''

        const amount = parseFloat(amountRaw)
        if (isNaN(amount) || amount === 0) {
          log.debug(`Row ${i} skipped: amount is invalid or 0 ("${amountRaw}"):`, row)
          skippedZeroAmount++
          continue
        }

        // Parse date: "DD/MM/YYYY"
        const [day, month, year] = dateStr.split('/').map(Number)
        const date = new Date(year!, month! - 1, day!)
        if (isNaN(date.getTime())) {
          log.debug(`Row ${i} skipped: Date parse failed for "${dateStr}":`, row)
          skippedDateMismatch++
          continue
        }

        const type: 'debit' | 'credit' = signRaw.toUpperCase() === 'CR' ? 'credit' : 'debit'

        results.push({
          date,
          description,
          amount: Math.abs(amount),
          type,
          ...(referenceNo ? { referenceNo } : {}),
        })
      }

      if (results.length === 0) {
        log.warn(
          `Extracted 0 transactions from ICICI credit CSV (total rows: ${rawRows.length}, skipped short: ${skippedShortRows}, date mismatches: ${skippedDateMismatch})`
        )
        log.debug('Sample CSV rows (first 15):', rawRows.slice(0, 15))
      } else {
        log.debug(
          `Finished parsing ICICI credit card statement: extracted ${results.length} transactions`
        )
      }

      return results
    } catch (err) {
      log.error('Exception during ICICI credit card parsing:', err)
      return []
    }
  },
}


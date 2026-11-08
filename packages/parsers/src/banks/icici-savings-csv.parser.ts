import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { createParserLogger } from '../logger.js'

const log = createParserLogger('icici_savings_csv')

/**
 * ICICI Bank Savings Account Statement Parser
 *
 * Format: CSV
 * Header lookup: `DATE,MODE,PARTICULARS,DEPOSITS,WITHDRAWALS,BALANCE`
 * 
 * Notes:
 * - Dates are currently formatted as "DD-MM-YYYY"
 * - Withdrawals and Deposits are strings and need parsing.
 */
export const iciciSavingsCsvParser: BankParser = {
  bankId: 'icici_savings_csv',
  displayName: 'ICICI Bank Savings Account (CSV)',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    log.debug(`Starting parse on buffer of size ${buffer.byteLength} bytes`)

    try {
      const text = new TextDecoder().decode(buffer)
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
      })

      if (result.errors && result.errors.length > 0) {
        log.warn('Papa.parse reported errors while parsing CSV:', result.errors)
      }

      const rows = result.data as string[][]
      log.debug(`Parsed ${rows.length} CSV rows`)
      if (rows.length === 0) {
        log.warn('CSV contained 0 data rows')
        return []
      }

      const results: ParsedTransaction[] = []
      let last: ParsedTransaction | null = null

      // Column mapping for easy access
      let colIdx = {
        date: -1,
        mode: -1,
        remarks: -1,
        deposits: -1,
        withdrawals: -1,
        balance: -1
      }

      let headerFound = false
      let skippedDateCount = 0
      let skippedZeroAmountCount = 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!

        if (!headerFound) {
          // Look for 'DATE' and 'PARTICULARS' in the header row
          const rowStr = row.map(c => String(c ?? '').trim().toUpperCase())
          if (rowStr.includes('DATE') && rowStr.includes('PARTICULARS')) {
            headerFound = true
            colIdx = {
              date: rowStr.indexOf('DATE'),
              mode: rowStr.indexOf('MODE'),
              remarks: rowStr.indexOf('PARTICULARS'),
              deposits: rowStr.indexOf('DEPOSITS'),
              withdrawals: rowStr.indexOf('WITHDRAWALS'),
              balance: rowStr.indexOf('BALANCE')
            }
            log.debug(`Header row identified at index ${i}:`, colIdx)

            if (colIdx.date === -1) log.warn('Header found but DATE column missing')
            if (colIdx.remarks === -1) log.warn('Header found but PARTICULARS column missing')
            if (colIdx.deposits === -1 && colIdx.withdrawals === -1) {
              log.warn('Neither DEPOSITS nor WITHDRAWALS column found in header')
            }
          }
          continue
        }

        const valueDate = String(row[colIdx.date] ?? '').trim()
        const remarks = String(row[colIdx.remarks] ?? '').trim()
        const depositStr = String(row[colIdx.deposits] ?? '0').replace(/,/g, '')
        const withdrawalStr = String(row[colIdx.withdrawals] ?? '0').replace(/,/g, '')
        const balanceStr = String(row[colIdx.balance] ?? '0').replace(/,/g, '')

        const deposit = parseFloat(depositStr) || 0
        const withdrawal = parseFloat(withdrawalStr) || 0
        const balance = parseFloat(balanceStr) || undefined

        // Skip rows without a valid date format (DD-MM-YYYY)
        if (!valueDate || !/^\d{2}-\d{2}-\d{4}$/.test(valueDate)) {
          if (skippedDateCount < 5 && (valueDate || remarks || deposit || withdrawal)) {
            log.debug(`Row ${i} skipped (date "${valueDate}" does not match DD-MM-YYYY):`, row)
          }
          skippedDateCount++
          continue
        }

        // Parse date: "DD-MM-YYYY"
        const [day, month, year] = valueDate.split('-').map(Number)
        const date = new Date(year!, month! - 1, day!)
        if (isNaN(date.getTime())) {
          if (skippedDateCount < 5) {
            log.debug(`Row ${i} skipped (date "${valueDate}" resulted in NaN Date):`, row)
          }
          skippedDateCount++
          continue
        }

        const amount = Math.max(withdrawal, deposit)
        if (amount === 0) {
          if (skippedZeroAmountCount < 5) {
            log.debug(`Row ${i} skipped (amount is 0; withdrawal=${withdrawal}, deposit=${deposit}):`, row)
          }
          skippedZeroAmountCount++
          continue
        }

        const type: 'debit' | 'credit' = withdrawal > 0 ? 'debit' : 'credit'

        const txn: ParsedTransaction = {
          date,
          description: remarks,
          amount,
          type,
          ...(balance !== undefined && !isNaN(balance) ? { balance } : {}),
        }

        results.push(txn)
        last = txn
      }

      if (!headerFound) {
        log.warn('Header row containing "DATE" and "PARTICULARS" was not found in CSV.')
        log.debug('First 15 CSV rows preview:', rows.slice(0, 15))
      } else {
        log.debug(
          `Finished parsing CSV: extracted ${results.length} transactions (${skippedDateCount} skipped date rows, ${skippedZeroAmountCount} zero amounts)`
        )
      }

      return results
    } catch (e) {
      log.error('Exception occurred during CSV parsing:', e)
      return []
    }
  },
}


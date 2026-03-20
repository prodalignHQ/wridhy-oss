import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

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
    const text = new TextDecoder().decode(buffer)
    try {
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
      })

      const rows = result.data as string[][]
      const results: ParsedTransaction[] = []
      let headerFound = false

      for (const row of rows) {
        if (!headerFound) {
          // Look for 'DATE' in index 0 and 'PARTICULARS' in index 2
          const col0 = String(row[0] ?? '').trim().toUpperCase()
          const col2 = String(row[2] ?? '').trim().toUpperCase()
          
          if (col0 === 'DATE' && col2 === 'PARTICULARS') {
            headerFound = true
          }
          continue
        }

        // CSV Row structure: 0: DATE, 1: MODE, 2: PARTICULARS, 3: DEPOSITS, 4: WITHDRAWALS, 5: BALANCE
        const valueDate = String(row[0] ?? '').trim()
        const remarks = String(row[2] ?? '').trim()
        const depositStr = String(row[3] ?? '0').replace(/,/g, '')
        const withdrawalStr = String(row[4] ?? '0').replace(/,/g, '')
        const balanceStr = String(row[5] ?? '0').replace(/,/g, '')

        const deposit = parseFloat(depositStr) || 0
        const withdrawal = parseFloat(withdrawalStr) || 0
        const balance = parseFloat(balanceStr) || undefined

        // Skip rows that look invalid or are totals
        if (!valueDate || !/^\d{2}-\d{2}-\d{4}$/.test(valueDate)) {
          continue
        }

        // Parse date: "DD-MM-YYYY"
        const [day, month, year] = valueDate.split('-').map(Number)
        const date = new Date(year!, month! - 1, day!)

        if (isNaN(date.getTime())) continue

        const amount = Math.max(withdrawal, deposit)
        if (amount === 0) continue

        const type: 'debit' | 'credit' = withdrawal > 0 ? 'debit' : 'credit'

        const txn: ParsedTransaction = {
          date,
          description: remarks,
          amount,
          type,
          ...(balance !== undefined && !isNaN(balance) ? { balance } : {}),
        }

        results.push(txn)
      }

      return results
    } catch (e) {
      return []
    }
  },
}

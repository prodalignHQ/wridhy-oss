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
      if (rows.length === 0) return []

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

      for (const row of rows) {
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
        last = txn
      }

      return results
    } catch (e) {
      return []
    }
  },
}

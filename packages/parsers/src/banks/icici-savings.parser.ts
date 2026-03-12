import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

/**
 * ICICI Bank Savings Account Statement Parser
 *
 * Format: XLS (legacy Excel .xls)
 * Header row: index 12 — [S No., Value Date, Transaction Date, Cheque Number,
 *                          Transaction Remarks, Withdrawal Amount(INR),
 *                          Deposit Amount(INR), Balance(INR)]
 * Data rows: index 13 onwards
 *
 * Notes:
 * - Some long remarks span two rows; the second row has a blank S No.
 *   We concatenate them with the previous row's description.
 * - Dates are strings in "DD/MM/YYYY" format.
 * - Withdrawal and Deposit are stored as numbers in the XLS.
 */
export const iciciSavingsParser: BankParser = {
  bankId: 'icici_savings',
  displayName: 'ICICI Bank Savings Account',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []

    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return []
    // Convert to array-of-arrays; blank cells become ''
    const rows: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    })

    const results: ParsedTransaction[] = []
    let headerFound = false
    let last: ParsedTransaction | null = null

    for (const row of rows) {
      // Detect header row by looking for "S No." in column index 1
      if (!headerFound) {
        const col1 = String(row[1] ?? '').trim()
        if (col1 === 'S No.') {
          headerFound = true
        }
        continue
      }

      // Row structure (0-indexed): [blank, SNo, ValueDate, TxnDate, ChequeNo, Remarks, Withdrawal, Deposit, Balance]
      const sNo = String(row[1] ?? '').trim()
      const valueDate = String(row[2] ?? '').trim()
      const remarks = String(row[5] ?? '').trim()
      const withdrawal = parseFloat(String(row[6] ?? '0')) || 0
      const deposit = parseFloat(String(row[7] ?? '0')) || 0
      const balance = parseFloat(String(row[8] ?? '0')) || undefined

      // Continuation row: S No. is blank and the previous transaction exists
      if (!sNo && last) {
        if (remarks) {
          last.description = last.description + ' ' + remarks
        }
        continue
      }

      // Skip rows that look like footers / totals
      if (!sNo || !valueDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(valueDate)) {
        continue
      }

      // Parse date: "DD/MM/YYYY"
      const [day, month, year] = valueDate.split('/').map(Number)
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
        ...(sNo ? { referenceNo: sNo } : {}),
      }

      results.push(txn)
      last = txn
    }

    return results
  },
}

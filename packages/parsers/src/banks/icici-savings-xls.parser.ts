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
export const iciciSavingsXlsParser: BankParser = {
  bankId: 'icici_savings_xls',
  displayName: 'ICICI Bank Savings Account (XLS)',

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

    if (rows.length === 0) return []

    const results: ParsedTransaction[] = []
    let last: ParsedTransaction | null = null

    // Column mapping for easy access
    let colIdx = {
      sNo: -1,
      valueDate: -1,
      remarks: -1,
      withdrawal: -1,
      deposit: -1,
      balance: -1
    }

    let headerFound = false

    for (const row of rows) {
      if (!headerFound) {
        // Look for the header row containing "S No." and "Value Date"
        const rowStr = row.map(c => String(c ?? '').trim().toLowerCase())
        if (rowStr.includes('s no.') && rowStr.includes('value date')) {
          headerFound = true
          colIdx = {
            sNo: rowStr.indexOf('s no.'),
            valueDate: rowStr.indexOf('value date'),
            remarks: rowStr.indexOf('transaction remarks'),
            withdrawal: rowStr.indexOf('withdrawal amount(inr)'),
            deposit: rowStr.indexOf('deposit amount(inr)'),
            balance: rowStr.indexOf('balance(inr)')
          }
        }
        continue
      }

      const sNo = String(row[colIdx.sNo] ?? '').trim()
      const valueDate = String(row[colIdx.valueDate] ?? '').trim()
      const remarks = String(row[colIdx.remarks] ?? '').trim()
      const withdrawal = parseFloat(String(row[colIdx.withdrawal] ?? '0')) || 0
      const deposit = parseFloat(String(row[colIdx.deposit] ?? '0')) || 0
      const balance = parseFloat(String(row[colIdx.balance] ?? '0')) || undefined

      // Continuation row: S No. is blank and the previous transaction exists
      if (!sNo && last) {
        if (remarks) {
          last.description = (last.description + ' ' + remarks).trim()
        }
        continue
      }

      // Skip rows without a valid date format (DD/MM/YYYY)
      if (!valueDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(valueDate)) {
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

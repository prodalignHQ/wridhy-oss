import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

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
    // Decode the buffer to a UTF-8 string
    const text = new TextDecoder('utf-8').decode(buffer)

    const { data: rawRows }: { data: string[][] } = Papa.parse(text, {
      skipEmptyLines: false,
    })

    const results: ParsedTransaction[] = []

    for (const row of rawRows) {
      // Each cell may be quoted; papaparse already strips the quotes.
      if (row.length < 7) continue

      const dateStr = row[0]?.trim() ?? ''
      // Only process rows where column 0 matches DD/MM/YYYY
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) continue

      const referenceNo = row[1]?.trim()
      const description = row[2]?.trim() ?? ''
      const amountRaw = row[5]?.trim() ?? ''
      const signRaw = row[6]?.trim() ?? ''

      const amount = parseFloat(amountRaw)
      if (isNaN(amount) || amount === 0) continue

      // Parse date: "DD/MM/YYYY"
      const [day, month, year] = dateStr.split('/').map(Number)
      const date = new Date(year!, month! - 1, day!)
      if (isNaN(date.getTime())) continue

      const type: 'debit' | 'credit' = signRaw.toUpperCase() === 'CR' ? 'credit' : 'debit'

      results.push({
        date,
        description,
        amount,
        type,
        ...(referenceNo ? { referenceNo } : {}),
      })
    }

    return results
  },
}

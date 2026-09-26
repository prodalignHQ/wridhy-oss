import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { loadXlsxSSF, type XlsxSSF } from '../xlsx-ssf.js'

/**
 * HDFC Bank Savings Account Statement Parser
 *
 * Supported Formats: XLSX, XLS, CSV
 *
 * Header identification:
 *   Looks for column headers containing:
 *   - "Date"
 *   - "Narration" / "Description" / "Particulars"
 *   - "Withdrawal Amt." / "Withdrawal" / "Debit"
 *   - "Deposit Amt." / "Deposit" / "Credit"
 *   - "Closing Balance" / "Balance"
 *   - "Chq./Ref.No." / "Cheque No"
 *
 * Notes:
 * - Date cell may be an Excel serial number (e.g. 46289) or formatted string (e.g. "24/09/26" or "24/09/2026").
 * - Narration can span multiple rows if a continuation row exists without a date.
 * - Amounts are parsed as absolute values (positive numbers) with type 'debit' or 'credit'.
 */
export const hdfcSavingsParser: BankParser = {
  bankId: 'hdfc_savings',
  displayName: 'HDFC Bank Savings Account',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    try {
      const ssf = await loadXlsxSSF()
      const workbook = xlsxRead(buffer, { type: 'array', cellDates: false })

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const rows: (string | number)[][] = xlsxUtils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
        })

        if (rows.length === 0) continue

        const transactions = parseSheetRows(rows, ssf)
        if (transactions.length > 0) {
          return transactions
        }
      }

      return []
    } catch (err) {
      console.warn('[Parsers] Failed to parse HDFC savings buffer:', err)
      return []
    }
  },
}

function parseDateCell(val: unknown, ssf: XlsxSSF | null): Date | null {
  if (val === null || val === undefined || val === '') return null

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }

  if (typeof val === 'number') {
    // Excel serial date code (modern dates between 1950 and 2070)
    if (val > 10000 && val < 100000) {
      try {
        if (ssf?.parse_date_code) {
          const parsed = ssf.parse_date_code(val)
          if (parsed && parsed.y && parsed.m && parsed.d) {
            const d = new Date(parsed.y, parsed.m - 1, parsed.d)
            if (!isNaN(d.getTime())) return d
          }
        }
      } catch {
        // Fall back to math conversion below
      }

      // Mathematical conversion for Excel serial date code
      const ms = (val - 25569) * 86400 * 1000
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      }
    }
    return null
  }

  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed.startsWith('*')) return null

    // Format: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY or DD-MM-YY
    const dateMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (dateMatch) {
      const day = parseInt(dateMatch[1]!, 10)
      const month = parseInt(dateMatch[2]!, 10)
      let year = parseInt(dateMatch[3]!, 10)
      if (year < 100) year += 2000

      const d = new Date(year, month - 1, day)
      return isNaN(d.getTime()) ? null : d
    }
  }

  return null
}

function parseSheetRows(rows: (string | number)[][], ssf: XlsxSSF | null): ParsedTransaction[] {
  let headerFound = false
  let colIdx = {
    date: -1,
    narration: -1,
    ref: -1,
    withdrawal: -1,
    deposit: -1,
    balance: -1,
  }

  const results: ParsedTransaction[] = []
  let last: ParsedTransaction | null = null

  for (const row of rows) {
    if (!headerFound) {
      const rowStr = row.map((c) => String(c ?? '').trim().toLowerCase())
      const dateIdx = rowStr.findIndex(
        (c) => c === 'date' || (c.includes('date') && !c.includes('value'))
      )
      const narrationIdx = rowStr.findIndex(
        (c) =>
          c.includes('narration') ||
          c.includes('description') ||
          c.includes('particulars') ||
          c.includes('transaction remarks')
      )
      const withdrawalIdx = rowStr.findIndex(
        (c) => c.includes('withdrawal') || (c.includes('debit') && !c.includes('credit'))
      )
      const depositIdx = rowStr.findIndex(
        (c) => c.includes('deposit') || (c.includes('credit') && !c.includes('debit'))
      )

      if (dateIdx !== -1 && narrationIdx !== -1 && (withdrawalIdx !== -1 || depositIdx !== -1)) {
        headerFound = true
        colIdx = {
          date: dateIdx,
          narration: narrationIdx,
          ref: rowStr.findIndex(
            (c) => c.includes('chq') || c.includes('ref') || c.includes('cheque')
          ),
          withdrawal: withdrawalIdx,
          deposit: depositIdx,
          balance: rowStr.findIndex((c) => c.includes('closing') || c.includes('balance')),
        }
      }
      continue
    }

    // Stop parsing if we reach the statement summary or end section
    const rowStr = row.map((c) => String(c ?? '').trim())
    if (
      rowStr.some((c) => {
        const lower = c.toLowerCase()
        return (
          lower.includes('statement summary') ||
          lower.includes('end of statement') ||
          lower.includes('generated on:')
        )
      })
    ) {
      break
    }

    const rawDate = row[colIdx.date]
    const rawNarration = String(row[colIdx.narration] ?? '').trim()

    // Skip separator lines like '********'
    if (
      rawNarration.startsWith('****') ||
      (typeof rawDate === 'string' && rawDate.startsWith('****'))
    ) {
      continue
    }

    const date = parseDateCell(rawDate, ssf)

    // Handle multiline narration continuation (no date, but description exists)
    if (!date && rawNarration && last) {
      last.description = (last.description + ' ' + rawNarration).trim()
      continue
    }

    if (!date) continue

    const withdrawalRaw = String(row[colIdx.withdrawal] ?? '')
      .replace(/,/g, '')
      .trim()
    const depositRaw = String(row[colIdx.deposit] ?? '')
      .replace(/,/g, '')
      .trim()
    const balanceRaw =
      colIdx.balance !== -1
        ? String(row[colIdx.balance] ?? '')
            .replace(/,/g, '')
            .trim()
        : ''

    const withdrawal = parseFloat(withdrawalRaw) || 0
    const deposit = parseFloat(depositRaw) || 0
    const balance = balanceRaw !== '' ? parseFloat(balanceRaw) : undefined

    const amount = Math.max(withdrawal, deposit)
    if (amount === 0) continue

    const type: 'debit' | 'credit' = withdrawal > 0 ? 'debit' : 'credit'

    let referenceNo = colIdx.ref !== -1 ? String(row[colIdx.ref] ?? '').trim() : undefined
    if (referenceNo && (referenceNo.startsWith('*') || referenceNo === '')) {
      referenceNo = undefined
    }

    const txn: ParsedTransaction = {
      date,
      description: rawNarration,
      amount,
      type,
      ...(balance !== undefined && !isNaN(balance) ? { balance } : {}),
      ...(referenceNo ? { referenceNo } : {}),
    }

    results.push(txn)
    last = txn
  }

  return results
}

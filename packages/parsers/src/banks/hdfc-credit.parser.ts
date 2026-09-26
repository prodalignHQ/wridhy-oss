import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

/**
 * HDFC Bank Credit Card Statement Parser
 *
 * Supported Formats: XLSX, XLS, CSV
 *
 * Header identification:
 *   Looks for column headers containing:
 *   - "Date & Time" / "Date"
 *   - "Description" / "Particulars" / "Transaction Details"
 *   - "AMT" / "Amount"
 *   - "Debit / Credit" / "Dr / Cr"
 *
 * Notes:
 * - Date cell may be formatted string (e.g. "16/08/2026 / 13:19") or Excel serial date code.
 * - Sign convention:
 *     "Cr" / "Credit" in Debit/Credit column -> credit (payment, refund)
 *     Blank or "Dr" -> debit (purchase, charge)
 * - Amounts are parsed as absolute values (positive numbers) with type 'debit' or 'credit'.
 * - Reference number can be extracted from description (e.g., "(Ref# ST262380083000010146965)")
 *   or from an explicit reference column if present.
 */
export const hdfcCreditParser: BankParser = {
  bankId: 'hdfc_credit',
  displayName: 'HDFC Bank Credit Card',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const rows: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
        })

        if (rows.length === 0) continue

        const transactions = parseSheetRows(rows)
        if (transactions.length > 0) {
          return transactions
        }
      }

      return []
    } catch (err) {
      console.warn('[Parsers] Failed to parse HDFC credit card buffer:', err)
      return []
    }
  },
}

function parseDateCell(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }

  if (typeof val === 'number') {
    // Excel serial date code
    if (val > 10000 && val < 100000) {
      try {
        const SSF = (XLSX as any).SSF || (XLSX as any).default?.SSF
        if (SSF?.parse_date_code) {
          const parsed = SSF.parse_date_code(val)
          if (parsed && parsed.y && parsed.m && parsed.d) {
            const d = new Date(
              parsed.y,
              parsed.m - 1,
              parsed.d,
              parsed.H || 0,
              parsed.M || 0,
              parsed.S || 0
            )
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
        return new Date(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds()
        )
      }
    }
    return null
  }

  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed.startsWith('*')) return null

    // Format: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY or DD-MM-YY with optional time
    const dateMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (dateMatch) {
      const day = parseInt(dateMatch[1]!, 10)
      const month = parseInt(dateMatch[2]!, 10)
      let year = parseInt(dateMatch[3]!, 10)
      if (year < 100) year += 2000

      // Match optional time: HH:mm or HH:mm:ss
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
      const hours = timeMatch ? parseInt(timeMatch[1]!, 10) : 0
      const minutes = timeMatch ? parseInt(timeMatch[2]!, 10) : 0
      const seconds = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0

      const d = new Date(year, month - 1, day, hours, minutes, seconds)
      return isNaN(d.getTime()) ? null : d
    }
  }

  return null
}

function parseSheetRows(rows: (string | number)[][]): ParsedTransaction[] {
  let headerFound = false
  let colIdx = {
    date: -1,
    desc: -1,
    amount: -1,
    type: -1,
    ref: -1,
  }

  const results: ParsedTransaction[] = []
  let last: ParsedTransaction | null = null

  for (const row of rows) {
    if (!headerFound) {
      const rowStr = row.map((c) => String(c ?? '').trim().toLowerCase())
      const dateIdx = rowStr.findIndex((c) => c.includes('date'))
      const descIdx = rowStr.findIndex(
        (c) =>
          c.includes('description') ||
          c.includes('particulars') ||
          c.includes('transaction details')
      )
      const amtIdx = rowStr.findIndex(
        (c) => c === 'amt' || c.includes('amount') || c.includes('billing')
      )

      if (dateIdx !== -1 && descIdx !== -1 && amtIdx !== -1) {
        headerFound = true
        colIdx = {
          date: dateIdx,
          desc: descIdx,
          amount: amtIdx,
          type: rowStr.findIndex(
            (c, i) =>
              i !== descIdx &&
              (c.includes('debit') ||
                c.includes('credit') ||
                c === 'cr' ||
                c === 'dr' ||
                c === 'cr/dr' ||
                c === 'dr/cr' ||
                c === 'type')
          ),
          ref: rowStr.findIndex((c) => c.includes('chq') || c.includes('ref')),
        }
      }
      continue
    }

    // Stop parsing if we reach summary sections
    const rowStr = row.map((c) => String(c ?? '').trim())
    if (
      rowStr.some((c) => {
        const lower = c.toLowerCase()
        return (
          lower.includes('reward points summary') ||
          lower.includes('rewards program') ||
          lower.includes('gst summary') ||
          lower.includes('account summary') ||
          lower.includes('registered office address')
        )
      })
    ) {
      break
    }

    const rawDate = row[colIdx.date]
    const rawDesc = String(row[colIdx.desc] ?? '').trim()

    // Skip separator or empty rows
    if (
      rawDesc.startsWith('****') ||
      (typeof rawDate === 'string' && rawDate.startsWith('****'))
    ) {
      continue
    }

    const date = parseDateCell(rawDate)

    // Handle multiline description continuation
    if (!date && rawDesc && last) {
      last.description = (last.description + ' ' + rawDesc).trim()
      continue
    }

    if (!date) continue

    const amtRaw = row[colIdx.amount]
    let amount = 0
    if (typeof amtRaw === 'number') {
      amount = amtRaw
    } else {
      const amtStr = String(amtRaw ?? '').replace(/,/g, '').trim()
      amount = parseFloat(amtStr) || 0
    }

    if (isNaN(amount) || amount === 0) continue
    amount = Math.abs(amount)

    const rawType = colIdx.type !== -1 ? String(row[colIdx.type] ?? '').trim() : ''
    const isCredit =
      rawType.toUpperCase().includes('CR') || rawType.toUpperCase().includes('CREDIT')
    const type: 'debit' | 'credit' = isCredit ? 'credit' : 'debit'

    // Extract reference number from explicit column or from description (e.g. "(Ref# ...)")
    let referenceNo: string | undefined
    if (colIdx.ref !== -1) {
      const directRef = String(row[colIdx.ref] ?? '').trim()
      if (directRef && !directRef.startsWith('*')) {
        referenceNo = directRef
      }
    }
    if (!referenceNo) {
      const refMatch = rawDesc.match(/\(Ref#\s*([^\)]+)\)/i)
      if (refMatch) {
        referenceNo = refMatch[1]!.trim()
      }
    }

    const txn: ParsedTransaction = {
      date,
      description: rawDesc,
      amount,
      type,
      ...(referenceNo ? { referenceNo } : {}),
    }

    results.push(txn)
    last = txn
  }

  return results
}

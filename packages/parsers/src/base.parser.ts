// ─── Parsed Transaction Shape ─────────────────────────────────────────────────

export interface ParsedTransaction {
  /** Transaction date */
  date: Date
  /** Raw description / narration from the statement */
  description: string
  /** Always a positive number */
  amount: number
  /** debit = money going out, credit = money coming in */
  type: 'debit' | 'credit'
  /** Closing/running balance (if the statement provides it) */
  balance?: number
  /** Bank-assigned reference number (cheque number, Sr.No, etc.) */
  referenceNo?: string
}

// ─── Parser Interface ─────────────────────────────────────────────────────────

export interface BankParser {
  /**
   * Unique identifier for this bank/statement type.
   * Maps to `bankId` used in the upload route.
   * Examples: "icici_savings", "icici_credit"
   */
  readonly bankId: string

  /** Human-readable name shown in the bank selector. */
  readonly displayName: string

  /**
   * Parse a raw file buffer into an array of transactions.
   * @param buffer - ArrayBuffer of the uploaded file
   * @returns Array of parsed transactions (may be empty; never throws on
   *          partial parse — bad rows are skipped)
   */
  parse(buffer: ArrayBuffer): ParsedTransaction[]
}

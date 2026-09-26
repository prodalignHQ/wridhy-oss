# How to Write Custom Bank Statement Parsers

MoMoney features a modular parsing package located in `packages/parsers`. Parsers convert raw file buffers (CSV, XLS, XLSX, PDF) into a standardized transaction format.

---

## 1. Architecture Overview

- **Source Location**: `packages/parsers/src/banks/`
- **Registry**: `packages/parsers/src/parser-registry.ts`
- **Consumer**: `apps/api/src/routes/statements.ts` and `apps/web/app/(app)/statements/`

---

## 2. Core Interfaces

All parsers must implement the `BankParser` interface from `packages/parsers/src/base.parser.ts`:

```typescript
export interface ParsedTransaction {
  date: Date
  description: string
  amount: number        // ALWAYS positive!
  type: 'debit' | 'credit'
  balance?: number      // Optional account balance after transaction
  referenceNo?: string  // Optional (e.g., UTR, Cheque No, Transaction ID)
}

export interface BankParser {
  readonly bankId: string       // Unique machine ID (e.g. "hdfc_savings", "axis_credit")
  readonly displayName: string  // Human-readable UI label
  parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> | ParsedTransaction[]
}
```

> [!IMPORTANT]
> **Amount Convention**: In MoMoney, `amount` must **always be a positive number** (`Math.abs(...)`). The `type` field (`'debit'` or `'credit'`) defines whether money entered or left the account. The API layer handles sign conversions during database insertion.

---

## 3. Implementation Patterns

### Pattern A: CSV Parsers (using PapaParse)

Create `packages/parsers/src/banks/[bank-name].parser.ts`:

```typescript
import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

export const myBankCsvParser: BankParser = {
  bankId: 'my_bank_savings',
  displayName: 'My Bank Savings (CSV)',

  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    const text = new TextDecoder('utf-8').decode(buffer)
    const { data } = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      header: false,
    })

    const transactions: ParsedTransaction[] = []

    // Locate header row or skip preamble metadata
    for (const row of data) {
      if (!row || row.length < 5) continue

      const dateStr = row[0]?.trim()
      const desc = row[1]?.trim()
      const debitStr = row[2]?.replace(/,/g, '').trim()
      const creditStr = row[3]?.replace(/,/g, '').trim()

      const debit = parseFloat(debitStr)
      const credit = parseFloat(creditStr)

      if (!isNaN(debit) && debit > 0) {
        transactions.push({
          date: new Date(dateStr),
          description: desc,
          amount: debit,
          type: 'debit',
        })
      } else if (!isNaN(credit) && credit > 0) {
        transactions.push({
          date: new Date(dateStr),
          description: desc,
          amount: credit,
          type: 'credit',
        })
      }
    }

    return transactions
  },
}
```

---

### Pattern B: Excel Parsers (XLS / XLSX using SheetJS)

Many banks (e.g., HDFC, ICICI, SBI) issue statements as Excel files or HTML tables disguised as `.xls`. Use `xlsx`:

```typescript
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import type { BankParser, ParsedTransaction } from '../base.parser.js'
import { loadXlsxSSF } from '../xlsx-ssf.js'

export const myBankExcelParser: BankParser = {
  bankId: 'my_bank_excel',
  displayName: 'My Bank (XLS/XLSX)',

  async parse(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
    const workbook = xlsxRead(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []

    const sheet = workbook.Sheets[sheetName]
    const rawRows = xlsxUtils.sheet_to_json<any[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false, // Ensures dates and formatted text are stringified
    })

    const transactions: ParsedTransaction[] = []

    for (const row of rawRows) {
      // Parse columns according to bank layout...
    }

    return transactions
  },
}
```

> [!WARNING]
> **Browser-compatibility constraints** (parsers run on-device in a Web Worker):
> - Use **named** xlsx imports (`read`, `utils`) — never `import * as XLSX` with
>   `(XLSX as any).default` access (breaks the Turbopack client build).
> - Excel serial dates: `await loadXlsxSSF()` from `../xlsx-ssf.js`, never a
>   static `import { SSF }` (breaks Node CJS interop).
> - No Node-only deps (`pdf-parse`, `fs`, `crypto`). PDF text comes from
>   `parseIciciPdfLines()` + `apps/web/lib/engine/pdf.ts` (pdfjs-dist).
> - Export browser-safe parsers from `packages/parsers/src/browser.ts` too.

> [!TIP]
> **Excel Date Formatting**: Excel stores dates as serial numbers. When using `raw: true`, use `await loadXlsxSSF()` then `ssf.parse_date_code(cellValue)` to convert serial integers back into year, month, and day components reliably (with math fallback `(val - 25569) * 86400 * 1000`).

---

## 4. Registering Your New Parser

Once implemented, register the parser in `packages/parsers/src/parser-registry.ts`:

```typescript
import { myBankCsvParser } from './banks/my-bank.parser.js'

export const parserRegistry = new Map<string, BankParser>([
  ['hdfc_savings', hdfcSavingsParser],
  ['hdfc_credit', hdfcCreditParser],
  ['icici_savings', iciciSavingsParser],
  ['my_bank_savings', myBankCsvParser], // <-- Register here
])
```

Export it in `packages/parsers/src/index.ts`:

```typescript
export * from './banks/my-bank.parser.js'
```

---

## 5. Adding the Bank to the UI Dropdown

To allow users to select the new bank when creating an account in the web app, update the bank options array in [`apps/web/app/(app)/accounts/page.tsx`](file:///Users/rohanmallya/Development/prodalign/momoney/apps/web/app/(app)/accounts/page.tsx):

```typescript
const BANK_OPTIONS = [
  { id: 'hdfc_savings', name: 'HDFC Bank - Savings' },
  { id: 'hdfc_credit', name: 'HDFC Bank - Credit Card' },
  { id: 'icici_savings', name: 'ICICI Bank - Savings' },
  { id: 'my_bank_savings', name: 'My Bank - Savings' }, // <-- Add here
]
```

---

## 6. Testing Your Parser

Create a test in `packages/parsers/__tests__/` or run with sample bank statement buffers to verify:
- Accurate extraction of both debit and credit transactions.
- Correct date parsing regardless of system timezone.
- Stripping of currency symbols and commas (e.g. `₹`, `,`).
- Proper handling of empty rows and statement header/footer banners.

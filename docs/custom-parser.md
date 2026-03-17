# Custom Bank Statement Parsers

This guide explains how to implement and register a new bank statement parser in MoMoney.

## Architecture Overview

MoMoney uses a centralized parsing system in `packages/parsers`. Parsers are responsible for converting raw file buffers (CSV, XLS, etc.) into a standardized `ParsedTransaction` format.

---

## 1. Define the Parser Implementation

Create a new file in `packages/parsers/src/banks/[bank-name].parser.ts`.

### Interface: `BankParser`
Your parser must implement the `BankParser` interface:

```typescript
export interface BankParser {
  readonly bankId: string       // Unique ID (e.g., "hdfc_savings")
  readonly displayName: string  // UI Label (e.g., "HDFC Bank Savings")
  parse(buffer: ArrayBuffer): ParsedTransaction[]
}
```

### Data Shape: `ParsedTransaction`
Ensure your parser returns objects matching this shape:

```typescript
export interface ParsedTransaction {
  date: Date
  description: string
  amount: number        // ALWAYS positive
  type: 'debit' | 'credit'
  balance?: number      // Optional
  referenceNo?: string  // Optional (e.g., Cheque No)
}
```

> [!IMPORTANT]
> **Amount Convention**: In MoMoney, the `amount` field in `ParsedTransaction` should be the absolute value (positive). The `type` field ('debit' or 'credit') determines the flow. The backend will handle sign conversion during DB insertion.

### Example (CSV Parser using PapaParse)

```typescript
import Papa from 'papaparse'
import type { BankParser, ParsedTransaction } from '../base.parser.js'

export const myBankParser: BankParser = {
  bankId: 'my_bank',
  displayName: 'My Custom Bank',
  parse(buffer: ArrayBuffer): ParsedTransaction[] {
    const text = new TextDecoder('utf-8').decode(buffer)
    const { data } = Papa.parse(text, { skipEmptyLines: true })
    
    // Logic to map CSV rows to ParsedTransaction[]
    return data.map(row => ({
      date: new Date(row[0]),
      description: row[1],
      amount: Math.abs(parseFloat(row[2])),
      type: row[2].startsWith('-') ? 'debit' : 'credit'
    }))
  }
}
```

---

## 2. Register the Parser

To make the parser available to the system, you must register it in two places:

### A. Export from `index.ts`
Modify `packages/parsers/src/index.ts`:
```typescript
export { myBankParser } from './banks/my-bank.parser.js'
```

### B. Add to `parser-registry.ts`
Modify `packages/parsers/src/parser-registry.ts`:
```typescript
import { myBankParser } from './banks/my-bank.parser.js'

const parsers: BankParser[] = [
  // ... existing parsers
  myBankParser,
]
```

---

## 3. Update Frontend UI

The frontend needs to know about the new parser to show it in the dropdowns.

### A. Accounts Page
Update the `BANKS` constant in `apps/web/app/(app)/accounts/page.tsx`:
```typescript
const BANKS = [
  // ...
  { id: 'my_bank', label: 'My Custom Bank' },
]
```

### B. Statements Page
Update the `BANKS` constant and the preview logic in `apps/web/app/(app)/statements/page.tsx`:

```typescript
// 1. Update Constant
const BANKS = [
  // ...
  { id: 'my_bank', label: 'My Custom Bank', ext: '.csv' },
]

// 2. Update useEffect for Preview
if (selectedBankId === 'my_bank') {
  const { myBankParser } = await import('@momoney/parsers')
  const parsed = myBankParser.parse(buffer)
  rows = parsed.map(p => ({ 
    date: p.date.toISOString(), 
    description: p.description, 
    amount: p.amount, 
    type: p.type 
  }))
}
```

---

## Best Practices

1. **Date Parsing**: Always specify the format (e.g., `DD/MM/YYYY`) as browsers can be inconsistent with raw `new Date()` calls.
2. **Robustness**: Wrap cell access in `row[index]?.trim() ?? ''` to prevent crashes on malformed rows.
3. **Filtering**: Use regex to validate date columns to skip header or footer rows automatically.
4. **Continuation Rows**: Some banks (like ICICI) span descriptions across multiple rows. Track the "last" transaction to append text if needed.

## Verification Checklist
- [ ] New parser file created in `packages/parsers/src/banks/`
- [ ] Parser exported in `packages/parsers/src/index.ts`
- [ ] Parser added to `parsers` array in `packages/parsers/src/parser-registry.ts`
- [ ] `bankId` added to `BANKS` in `apps/web/app/(app)/accounts/page.tsx`
- [ ] `bankId` and preview logic added to `apps/web/app/(app)/statements/page.tsx`

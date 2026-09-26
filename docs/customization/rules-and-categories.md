# Rules Engine, Merchants & System Categories

This guide explains how MoMoney organizes financial taxonomy, runs automated categorization, and normalizes merchant names.

---

## 1. Category Hierarchy & System Categories

Categories in MoMoney classify transactions into income, expenses, investments, or transfers.

### System Categories vs. User Categories
- **System Categories**: Defined with `userId: null` (or seeded for the local user in SQLite). These are default presets available to all accounts (e.g. *Food & Dining*, *Transport*, *Investments*, *Utilities*).
- **User Categories**: Created by the user with their `userId`. Users can customize icons, hex colors, and assign parent categories.

### Category Types
Every category belongs to one of four primary types:
- `expense`: Money spent on goods and services (groceries, dining, entertainment).
- `income`: Money earned (salary, dividends, freelance, interest).
- `investment`: Money moved into wealth accumulation assets (mutual funds, stocks, real estate).
- `transfer`: Neutral money movements between accounts owned by the same user (paying a credit card bill from savings).

---

## 2. Automated Categorization Rules Engine

The rules engine lives in `packages/rules-engine/src/rules-engine.ts`. When a bank statement is imported, transactions pass through the rules engine before saving to the database.

### Rule Evaluation Order
Rules are evaluated in order of `priority` (ascending: 1, 2, 3...):

```typescript
export interface Rule {
  id: string
  pattern: string
  matchType: 'contains' | 'exact' | 'starts_with' | 'regex'
  categoryId: string
  priority: number
}
```

- If a rule matches a transaction's description or merchant name, the transaction is automatically assigned that `categoryId`.
- Higher priority rules take precedence over lower priority rules.
- If no user rule matches, merchant normalization mapping is checked.
- If no merchant matches, the transaction falls back to the default system category `Uncategorized`.

---

## 3. Merchant Normalization

Bank statement descriptions often contain cryptic terminal codes, dates, and locations (e.g., `POS 40128394 SWIGGY BANGALORE IN`).

MoMoney normalizes these via the `merchants` table:
- `rawPatterns`: Comma-separated list or regex pattern matching messy raw text.
- `normalizedName`: Clean human-readable brand name (e.g., `Swiggy`).
- `defaultCategoryId`: Automatically categorizes transactions matching this merchant if no higher-priority user rule overrides it.

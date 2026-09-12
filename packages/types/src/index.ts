import { z } from 'zod'

// ─── Owner ────────────────────────────────────────────────────────────────────


export const OwnerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  notes: z.string().max(40).nullable(),
  color: z.string(),
  isDefault: z.boolean(),
  createdAt: z.date(),
})
export type Owner = z.infer<typeof OwnerSchema>

export const CreateOwnerSchema = z.object({
  name: z.string().min(1).max(100),
  notes: z.string().max(40).optional(),
  color: z.string().optional(),
})
export type CreateOwner = z.infer<typeof CreateOwnerSchema>

// ─── Account ──────────────────────────────────────────────────────────────────

export const AccountTypeSchema = z.enum(['bank', 'credit_card', 'wallet', 'investment'])
export type AccountType = z.infer<typeof AccountTypeSchema>

export const AccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountName: z.string().min(1).max(100),
  accountType: AccountTypeSchema,
  bankName: z.string().min(1).max(100),
  currency: z.string().default('INR'),
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Account = z.infer<typeof AccountSchema>

export const CreateAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  accountType: AccountTypeSchema,
  bankName: z.string().min(1).max(100),
  currency: z.string().default('INR'),
})
export type CreateAccount = z.infer<typeof CreateAccountSchema>

export const CategoryTypeSchema = z.enum(['expense', 'investment', 'income', 'transfer'])
export type CategoryType = z.infer<typeof CategoryTypeSchema>

export const CategorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  name: z.string().min(1).max(100),
  type: CategoryTypeSchema.default('expense'),
  icon: z.string().nullable(),
  color: z.string(),
  parentId: z.string().uuid().nullable(),
  isSystem: z.boolean(),
  createdAt: z.date(),
})
export type Category = z.infer<typeof CategorySchema>

// ─── Categorization Rule ──────────────────────────────────────────────────────

export const MatchFieldSchema = z.enum(['merchant', 'description', 'amount'])
export type MatchField = z.infer<typeof MatchFieldSchema>

export const MatchTypeSchema = z.enum(['contains', 'equals', 'regex', 'gt', 'lt'])
export type MatchType = z.infer<typeof MatchTypeSchema>

export const RuleSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  matchField: MatchFieldSchema,
  matchType: MatchTypeSchema,
  matchValue: z.string(),
  categoryId: z.string().uuid(),
  priority: z.number().int().min(1).max(9999),
  source: z.enum(['system', 'user']),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Rule = z.infer<typeof RuleSchema>

// ─── Transaction ──────────────────────────────────────────────────────────────

export const TransactionTypeSchema = z.enum(['debit', 'credit'])
export type TransactionType = z.infer<typeof TransactionTypeSchema>

export const TransactionOwnerSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  ownerId: z.string().uuid(),
  amount: z.string(), // numeric string from DB
  percentage: z.string(), // numeric string from DB
})
export type TransactionOwner = z.infer<typeof TransactionOwnerSchema>

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  statementId: z.string().uuid().nullable(),
  date: z.date(),
  description: z.string(),
  merchant: z.string().nullable(),
  amount: z.string(), // numeric string from DB
  type: TransactionTypeSchema,
  isOneTime: z.boolean().default(false),
  categoryId: z.string().uuid().nullable(),
  comment: z.string().nullable(),
  dedupHash: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Joined fields
  owners: z.array(TransactionOwnerSchema).optional(),
  category: CategorySchema.nullable().optional(),
})
export type Transaction = z.infer<typeof TransactionSchema>

// ─── Net Worth ────────────────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum(['bank_account', 'investment', 'real_estate', 'crypto', 'cash', 'other'])
export type AssetType = z.infer<typeof AssetTypeSchema>

export const AssetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ownerId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  type: AssetTypeSchema,
  value: z.string(),
  currency: z.string().default('INR'),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).nullable().optional(),
  valuationDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Asset = z.infer<typeof AssetSchema>

export const LiabilityTypeSchema = z.enum(['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other'])
export type LiabilityType = z.infer<typeof LiabilityTypeSchema>

export const LiabilitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ownerId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  type: LiabilityTypeSchema,
  outstandingAmount: z.string(),
  interestRate: z.string().nullable(),
  monthlyPayment: z.string().nullable(),
  lastUpdated: z.date(),
  createdAt: z.date(),
})
export type Liability = z.infer<typeof LiabilitySchema>

export const NetWorthSnapshotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ownerId: z.string().uuid().nullable().optional(),
  snapshotDate: z.date(),
  totalAssets: z.string(),
  totalLiabilities: z.string(),
  netWorth: z.string(),
  assetBreakdown: z.array(z.object({ name: z.string(), type: z.string(), value: z.number(), equityDebtTag: z.string().optional() })).nullable(),
  liabilityBreakdown: z.array(z.object({ name: z.string(), type: z.string(), amount: z.number() })).nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
})
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>

// ─── Insights ─────────────────────────────────────────────────────────────────

export type AccountingMode = 'invoice' | 'transaction'

export const MonthlyInsightSchema = z.object({
  totalSpend: z.string(),
  totalInvestments: z.string().optional(),
  totalIncome: z.string(),
  netFlow: z.string(),
  topCategories: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string(),
    amount: z.string(),
    percentage: z.number(),
  })),
  uncategorizedCount: z.number(),
  mode: z.enum(['invoice', 'transaction']).optional(),
  reconciliation: z.object({
    invoiceId: z.string().optional(),
    invoiceName: z.string().optional(),
    invoiceStatus: z.string().optional(),
    statementCount: z.number().optional(),
    statementNames: z.array(z.string()).optional(),
  }).optional(),
})
export type MonthlyInsight = z.infer<typeof MonthlyInsightSchema>

export const YearlyInsightSchema = z.array(z.object({
  month: z.string(), // YYYY-MM
  spend: z.string(),
  income: z.string(),
}))
export type YearlyInsight = z.infer<typeof YearlyInsightSchema>


export const CategoryComparisonSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  currentAmount: z.string(),
  prevAmount: z.string(),
  diff: z.string(),
  diffPercentage: z.number(),
}))
export type CategoryComparison = z.infer<typeof CategoryComparisonSchema>

export const CategoryAverageSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  avgAmount: z.string(),
  currentAmount: z.string(),
}))
export type CategoryAverage = z.infer<typeof CategoryAverageSchema>


// ─── API Response Envelope ────────────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({ page: z.number(), total: z.number() }).optional(),
  })

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type ApiError = z.infer<typeof ApiErrorSchema>

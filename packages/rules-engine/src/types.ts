export type MatchField = 'merchant' | 'description' | 'amount'
export type MatchType = 'contains' | 'equals' | 'regex' | 'gt' | 'lt'

export interface Rule {
  id: string
  userId: string | null
  matchField: MatchField
  matchType: MatchType
  matchValue: string
  categoryId: string
  priority: number
  source: 'system' | 'user'
  isActive: boolean
}

export interface MerchantRecord {
  id: string
  userId: string | null
  rawPatterns: string[]
  normalizedName: string
  defaultCategoryId: string | null
  isSystem: boolean
}

export interface ParsedTransaction {
  id?: string
  date: Date
  description: string
  merchant?: string | null
  amount: number
  type: 'debit' | 'credit'
  categoryId?: string | null
}

export interface Category {
  id: string
  name: string
  color: string | null
}

export interface CategorizeResult {
  categoryId: string
  ruleId: string
  matchedOn: 'rule' | 'merchant' | 'default'
}

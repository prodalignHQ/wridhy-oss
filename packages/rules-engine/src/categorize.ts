import type { Rule, ParsedTransaction, CategorizeResult, Category, MerchantRecord } from './types.js'
import { normalizeMerchant, getDefaultMerchants } from './normalize-merchant.js'

const DEFAULT_CATEGORY = 'Uncategorized'

function matchesRule(txn: ParsedTransaction, rule: Rule): boolean {
  const { matchField, matchType, matchValue } = rule

  // Never match if the matchValue is empty — would cause includes('') to match everything
  if (!matchValue || !matchValue.trim()) return false

  let valueToMatch: string

  switch (matchField) {
    case 'merchant':
      valueToMatch = txn.merchant || ''
      break
    case 'description':
      valueToMatch = txn.description
      break
    case 'amount':
      valueToMatch = txn.amount.toString()
      break
    default:
      return false
  }

  if (!valueToMatch) return false

  const upperValue = valueToMatch.toUpperCase()
  const upperMatch = matchValue.toUpperCase()

  switch (matchType) {
    case 'contains':
      return upperValue.includes(upperMatch)
    case 'equals':
      return upperValue === upperMatch
    case 'regex':
      try {
        const regex = new RegExp(matchValue, 'i')
        return regex.test(valueToMatch)
      } catch {
        return false
      }
    case 'gt':
      const numValue = parseFloat(valueToMatch)
      const numMatch = parseFloat(matchValue)
      return !isNaN(numValue) && !isNaN(numMatch) && numValue > numMatch
    case 'lt':
      const numValueLt = parseFloat(valueToMatch)
      const numMatchLt = parseFloat(matchValue)
      return !isNaN(numValueLt) && !isNaN(numMatchLt) && numValueLt < numMatchLt
    default:
      return false
  }
}

export function categorize(
  txn: ParsedTransaction,
  rules: Rule[],
  categories: Category[],
  userMerchants: MerchantRecord[] = [],
  systemMerchants: MerchantRecord[] = getDefaultMerchants()
): CategorizeResult {
  // Priority order:
  // 1. User rules (1-999)
  // 2. System rules (1000-4999)
  // 3. Merchant dictionary (5000)
  // 4. Default (9999)

  // Sort rules: user rules first, then by priority
  const sortedRules = [...rules].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === 'user' ? -1 : 1
    }
    return a.priority - b.priority
  })

  // Check user rules
  for (const rule of sortedRules) {
    if (rule.source === 'user' && rule.isActive) {
      if (matchesRule(txn, rule)) {
        return {
          categoryId: rule.categoryId,
          ruleId: rule.id,
          matchedOn: 'rule',
        }
      }
    }
  }

  // Check system rules
  for (const rule of sortedRules) {
    if (rule.source === 'system' && rule.isActive) {
      if (matchesRule(txn, rule)) {
        return {
          categoryId: rule.categoryId,
          ruleId: rule.id,
          matchedOn: 'rule',
        }
      }
    }
  }

  // Check merchant dictionary (priority 5000)
  const merchantRecord = normalizeMerchant(txn.description, userMerchants, systemMerchants)
  if (merchantRecord && merchantRecord.defaultCategoryId) {
    return {
      categoryId: merchantRecord.defaultCategoryId,
      ruleId: merchantRecord.id,
      matchedOn: 'merchant',
    }
  }

  // Find default category
  const defaultCategory = categories.find(c => c.name === DEFAULT_CATEGORY)
  if (defaultCategory) {
    return {
      categoryId: defaultCategory.id,
      ruleId: 'default',
      matchedOn: 'default',
    }
  }

  // No category matched — leave uncategorized
  return {
    categoryId: '',
    ruleId: 'none',
    matchedOn: 'default',
  }
}

export function getCategoryByName(categories: Category[], name: string): Category | undefined {
  return categories.find(c => c.name.toLowerCase() === name.toLowerCase())
}

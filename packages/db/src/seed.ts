import { db } from './index.js'
import { categories, categorizationRules, merchants } from './schema.js'

async function seedSystemCategories() {
  console.log('🌱 Seeding system categories...')

  const defaultCategories = [
    { name: 'Food & Dining', icon: '🍔', color: '#f43f5e' },
    { name: 'Transport', icon: '🚗', color: '#3b82f6' },
    { name: 'Shopping', icon: '🛍️', color: '#eab308' },
    { name: 'Entertainment', icon: '🍿', color: '#a855f7' },
    { name: 'Utilities', icon: '⚡', color: '#06b6d4' },
    { name: 'Health', icon: '⚕️', color: '#10b981' },
    { name: 'Travel', icon: '✈️', color: '#f97316' },
    { name: 'Income', icon: '💰', color: '#84cc16' },
    { name: 'Transfers', icon: '🔄', color: '#64748b' },
    { name: 'Subscriptions', icon: '📅', color: '#ec4899' },
    { name: 'Uncategorized', icon: '❓', color: '#94a3b8' },
  ]

  for (const cat of defaultCategories) {
    const existing = await db.query.categories.findFirst({
      where: (categories, { and, eq, isNull }) =>
        and(eq(categories.name, cat.name), isNull(categories.userId)),
    })

    if (!existing) {
      await db.insert(categories).values({
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isSystem: true,
      })
      console.log(`✅ Inserted category: ${cat.name}`)
    } else {
      console.log(`⏭️ Category already exists: ${cat.name}`)
    }
  }

  console.log('✅ System categories seeding complete.')
}

async function getCategoryId(name: string): Promise<string | null> {
  const cat = await db.query.categories.findFirst({
    where: (categories, { and, eq, isNull }) =>
      and(eq(categories.name, name), isNull(categories.userId)),
  })
  return cat?.id || null
}

async function seedSystemRules() {
  console.log('🌱 Seeding system rules...')

  const foodCategoryId = await getCategoryId('Food & Dining')
  const transportCategoryId = await getCategoryId('Transport')
  const shoppingCategoryId = await getCategoryId('Shopping')
  const entertainmentCategoryId = await getCategoryId('Entertainment')
  const utilitiesCategoryId = await getCategoryId('Utilities')
  const incomeCategoryId = await getCategoryId('Income')
  const subscriptionsCategoryId = await getCategoryId('Subscriptions')
  const cashCategoryId = await getCategoryId('Transfers')

  if (!foodCategoryId || !transportCategoryId || !shoppingCategoryId || 
      !entertainmentCategoryId || !utilitiesCategoryId || !incomeCategoryId ||
      !subscriptionsCategoryId || !cashCategoryId) {
    console.error('❌ Missing required categories for seeding rules')
    return
  }

  const systemRules = [
    { matchField: 'description', matchType: 'contains', matchValue: 'SWIGGY', categoryId: foodCategoryId, priority: 1100 },
    { matchField: 'description', matchType: 'contains', matchValue: 'ZOMATO', categoryId: foodCategoryId, priority: 1101 },
    { matchField: 'description', matchType: 'contains', matchValue: 'UBER EATS', categoryId: foodCategoryId, priority: 1102 },
    { matchField: 'description', matchType: 'contains', matchValue: 'DOMINOS', categoryId: foodCategoryId, priority: 1103 },
    { matchField: 'description', matchType: 'contains', matchValue: 'PIZZA', categoryId: foodCategoryId, priority: 1104 },
    { matchField: 'description', matchType: 'contains', matchValue: 'KFC', categoryId: foodCategoryId, priority: 1105 },
    { matchField: 'description', matchType: 'contains', matchValue: 'MC DONALD', categoryId: foodCategoryId, priority: 1106 },
    { matchField: 'description', matchType: 'contains', matchValue: 'BURGER KING', categoryId: foodCategoryId, priority: 1107 },
    { matchField: 'description', matchType: 'contains', matchValue: 'UBER', categoryId: transportCategoryId, priority: 1200 },
    { matchField: 'description', matchType: 'contains', matchValue: 'OLA', categoryId: transportCategoryId, priority: 1201 },
    { matchField: 'description', matchType: 'contains', matchValue: 'RAPIDO', categoryId: transportCategoryId, priority: 1202 },
    { matchField: 'description', matchType: 'contains', matchValue: 'METRO', categoryId: transportCategoryId, priority: 1203 },
    { matchField: 'description', matchType: 'contains', matchValue: 'AMAZON', categoryId: shoppingCategoryId, priority: 1300 },
    { matchField: 'description', matchType: 'contains', matchValue: 'FLIPKART', categoryId: shoppingCategoryId, priority: 1301 },
    { matchField: 'description', matchType: 'contains', matchValue: 'MYNTRA', categoryId: shoppingCategoryId, priority: 1302 },
    { matchField: 'description', matchType: 'contains', matchValue: 'NETFLIX', categoryId: subscriptionsCategoryId, priority: 1400 },
    { matchField: 'description', matchType: 'contains', matchValue: 'SPOTIFY', categoryId: subscriptionsCategoryId, priority: 1401 },
    { matchField: 'description', matchType: 'contains', matchValue: 'DISNEY', categoryId: subscriptionsCategoryId, priority: 1402 },
    { matchField: 'description', matchType: 'contains', matchValue: 'HOTSTAR', categoryId: subscriptionsCategoryId, priority: 1403 },
    { matchField: 'description', matchType: 'contains', matchValue: 'PRIME VIDEO', categoryId: subscriptionsCategoryId, priority: 1404 },
    { matchField: 'description', matchType: 'contains', matchValue: 'YOUTUBE', categoryId: subscriptionsCategoryId, priority: 1405 },
    { matchField: 'description', matchType: 'contains', matchValue: 'APPLE', categoryId: subscriptionsCategoryId, priority: 1406 },
    { matchField: 'description', matchType: 'contains', matchValue: 'GITHUB', categoryId: subscriptionsCategoryId, priority: 1407 },
    { matchField: 'description', matchType: 'contains', matchValue: 'SALARY', categoryId: incomeCategoryId, priority: 1500 },
    { matchField: 'description', matchType: 'contains', matchValue: 'NEFT CR', categoryId: incomeCategoryId, priority: 1501 },
    { matchField: 'description', matchType: 'contains', matchValue: 'IMPS CR', categoryId: incomeCategoryId, priority: 1502 },
    { matchField: 'description', matchType: 'contains', matchValue: 'INTEREST', categoryId: incomeCategoryId, priority: 1503 },
    { matchField: 'description', matchType: 'contains', matchValue: 'DIVIDEND', categoryId: incomeCategoryId, priority: 1504 },
    { matchField: 'description', matchType: 'contains', matchValue: 'ATM WDL', categoryId: cashCategoryId, priority: 1600 },
    { matchField: 'description', matchType: 'contains', matchValue: 'ATM WITHDRAWAL', categoryId: cashCategoryId, priority: 1601 },
  ]

  for (const rule of systemRules) {
    const existing = await db.query.categorizationRules.findFirst({
      where: (categorizationRules, { and, eq, isNull }) =>
        and(
          eq(categorizationRules.matchField, rule.matchField as 'merchant' | 'description' | 'amount'),
          eq(categorizationRules.matchType, rule.matchType as 'contains' | 'equals' | 'regex' | 'gt' | 'lt'),
          eq(categorizationRules.matchValue, rule.matchValue),
          eq(categorizationRules.source, 'system'),
          isNull(categorizationRules.userId)
        ),
    })

    if (!existing) {
      await db.insert(categorizationRules).values({
        userId: null,
        matchField: rule.matchField as 'merchant' | 'description' | 'amount',
        matchType: rule.matchType as 'contains' | 'equals' | 'regex' | 'gt' | 'lt',
        matchValue: rule.matchValue,
        categoryId: rule.categoryId,
        priority: rule.priority,
        source: 'system',
        isActive: true,
      })
      console.log(`✅ Inserted rule: ${rule.matchValue} → category ${rule.priority}`)
    } else {
      console.log(`⏭️ Rule already exists: ${rule.matchValue}`)
    }
  }

  console.log('✅ System rules seeding complete.')
}

async function seedSystemMerchants() {
  console.log('🌱 Seeding system merchants...')

  const foodCategoryId = await getCategoryId('Food & Dining')
  const transportCategoryId = await getCategoryId('Transport')
  const shoppingCategoryId = await getCategoryId('Shopping')
  const subscriptionsCategoryId = await getCategoryId('Subscriptions')
  const incomeCategoryId = await getCategoryId('Income')
  const cashCategoryId = await getCategoryId('Transfers')

  const systemMerchants = [
    { rawPatterns: ['AMZN', 'AMAZON', 'AMAZON PAY', 'AMZN MKTP'], normalizedName: 'Amazon', defaultCategoryId: shoppingCategoryId },
    { rawPatterns: ['SWIGGY', 'SWIGGY INSTAMART'], normalizedName: 'Swiggy', defaultCategoryId: foodCategoryId },
    { rawPatterns: ['ZOMATO', 'ZOMATO FOOD'], normalizedName: 'Zomato', defaultCategoryId: foodCategoryId },
    { rawPatterns: ['UBER', 'UBER EATS', 'UBER TRIP'], normalizedName: 'Uber', defaultCategoryId: transportCategoryId },
    { rawPatterns: ['OLA', 'OLA CABS'], normalizedName: 'Ola', defaultCategoryId: transportCategoryId },
    { rawPatterns: ['NETFLIX'], normalizedName: 'Netflix', defaultCategoryId: subscriptionsCategoryId },
    { rawPatterns: ['SPOTIFY'], normalizedName: 'Spotify', defaultCategoryId: subscriptionsCategoryId },
    { rawPatterns: ['DISNEY', 'HOTSTAR', 'DISNEY+'], normalizedName: 'Disney+ Hotstar', defaultCategoryId: subscriptionsCategoryId },
    { rawPatterns: ['PRIME VIDEO', 'AMAZON PRIME'], normalizedName: 'Amazon Prime', defaultCategoryId: subscriptionsCategoryId },
    { rawPatterns: ['SALARY', 'PAYROLL'], normalizedName: 'Salary', defaultCategoryId: incomeCategoryId },
    { rawPatterns: ['INTEREST', 'FD INTEREST', 'DIVIDEND'], normalizedName: 'Interest Income', defaultCategoryId: incomeCategoryId },
    { rawPatterns: ['ATM WDL', 'ATM WITHDRAWAL'], normalizedName: 'ATM', defaultCategoryId: cashCategoryId },
  ]

  for (const merchant of systemMerchants) {
    const existing = await db.query.merchants.findFirst({
      where: (merchants, { and, eq, isNull }) =>
        and(
          eq(merchants.normalizedName, merchant.normalizedName),
          eq(merchants.isSystem, true),
          isNull(merchants.userId)
        ),
    })

    if (!existing) {
      await db.insert(merchants).values({
        userId: null,
        rawPatterns: merchant.rawPatterns,
        normalizedName: merchant.normalizedName,
        defaultCategoryId: merchant.defaultCategoryId,
        isSystem: true,
      })
      console.log(`✅ Inserted merchant: ${merchant.normalizedName}`)
    } else {
      console.log(`⏭️ Merchant already exists: ${merchant.normalizedName}`)
    }
  }

  console.log('✅ System merchants seeding complete.')
}

async function seed() {
  try {
    await seedSystemCategories()
    await seedSystemRules()
    await seedSystemMerchants()
    console.log('🎉 All seeding complete!')
    process.exit(0)
  } catch (e) {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  }
}

seed()

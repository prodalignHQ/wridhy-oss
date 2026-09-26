import { eq, isNull } from 'drizzle-orm'
import { db, users, owners, categories, categorizationRules, merchants } from './index.js'

export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001'
export const LOCAL_USER_EMAIL = 'local@momoney.internal'

export async function ensureLocalUserAndSeed() {
  try {
    // 1. Check/create local user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, LOCAL_USER_ID),
    })

    if (!existingUser) {
      await db.insert(users).values({
        id: LOCAL_USER_ID,
        email: LOCAL_USER_EMAIL,
        name: 'Local User',
        emailVerified: true,
      })

      // Default owner "Self"
      await db.insert(owners).values({
        userId: LOCAL_USER_ID,
        name: 'Self',
        color: 'indigo',
        isDefault: true,
      })
    }

    // 2. Check/seed default system categories
    const systemCategoryCount = await db.query.categories.findFirst({
      where: isNull(categories.userId),
    })

    if (!systemCategoryCount) {
      const defaultCategories: Array<{
        name: string
        icon: string
        color: string
        type: 'expense' | 'investment' | 'income' | 'transfer'
      }> = [
        { name: 'Food & Dining', icon: '🍔', color: '#f43f5e', type: 'expense' },
        { name: 'Transport', icon: '🚗', color: '#3b82f6', type: 'expense' },
        { name: 'Shopping', icon: '🛍️', color: '#eab308', type: 'expense' },
        { name: 'Entertainment', icon: '🍿', color: '#a855f7', type: 'expense' },
        { name: 'Utilities', icon: '⚡', color: '#06b6d4', type: 'expense' },
        { name: 'Health', icon: '⚕️', color: '#10b981', type: 'expense' },
        { name: 'Travel', icon: '✈️', color: '#f97316', type: 'expense' },
        { name: 'Investments', icon: '📈', color: '#10b981', type: 'investment' },
        { name: 'Income', icon: '💰', color: '#84cc16', type: 'income' },
        { name: 'Transfers', icon: '🔄', color: '#64748b', type: 'transfer' },
        { name: 'Subscriptions', icon: '📅', color: '#ec4899', type: 'expense' },
        { name: 'Uncategorized', icon: '❓', color: '#94a3b8', type: 'expense' },
      ]

      for (const cat of defaultCategories) {
        await db.insert(categories).values({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          type: cat.type,
          isSystem: true,
        })
      }
    }
  } catch (err) {
    console.error('Failed to auto-seed local SQLite user/categories:', err)
  }
}

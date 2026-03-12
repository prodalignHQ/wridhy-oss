import { db } from './index.js'
import { categories } from './schema.js'

async function seedSystemCategories() {
  console.log('🌱 Seeding system categories...')

  const defaultCategories = [
    { name: 'Food & Dining', icon: '🍔', color: '#f43f5e' }, // rose-500
    { name: 'Transport', icon: '🚗', color: '#3b82f6' }, // blue-500
    { name: 'Shopping', icon: '🛍️', color: '#eab308' }, // yellow-500
    { name: 'Entertainment', icon: '🍿', color: '#a855f7' }, // purple-500
    { name: 'Utilities', icon: '⚡', color: '#06b6d4' }, // cyan-500
    { name: 'Health', icon: '⚕️', color: '#10b981' }, // emerald-500
    { name: 'Travel', icon: '✈️', color: '#f97316' }, // orange-500
    { name: 'Income', icon: '💰', color: '#84cc16' }, // lime-500
    { name: 'Transfers', icon: '🔄', color: '#64748b' }, // slate-500
    { name: 'Subscriptions', icon: '📅', color: '#ec4899' }, // pink-500
    { name: 'Uncategorized', icon: '❓', color: '#94a3b8' }, // slate-400
  ]

  for (const cat of defaultCategories) {
    // Check if system category exists by name (since userId is null for system)
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
  process.exit(0)
}

seedSystemCategories().catch((e) => {
  console.error('❌ Error seeding system categories:', e)
  process.exit(1)
})

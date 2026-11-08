import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import {
  db,
  rawPgSql,
  users,
  accounts,
  owners,
  financialAccounts,
  categories,
  statements,
  transactions,
  transactionOwners,
  assets,
  liabilities,
  netWorthSnapshots,
  financialYearIncomes,
  salarySources,
  salaryRevisions,
} from './index.js'
import {
  seedSystemCategories,
  seedSystemRules,
  seedSystemMerchants,
} from './seed.js'

function computeDedupHash(
  accountId: string,
  date: Date,
  amount: number,
  description: string,
  type: 'debit' | 'credit'
): string {
  const signedAmount = type === 'credit' ? -Math.abs(amount) : Math.abs(amount)
  const key = `${accountId}|${date.toISOString()}|${signedAmount.toFixed(2)}|${description.slice(0, 50)}`
  return createHash('sha256').update(key).digest('hex')
}

export async function seedDemo() {
  console.log('🚀 Starting MoMoney Demo Database Seed...')

  // 1. Ensure system categories, rules, and merchants exist
  await seedSystemCategories()
  await seedSystemRules()
  await seedSystemMerchants()

  // Build category cache by name
  const allCategories = await db.query.categories.findMany()
  const catMap = new Map<string, string>()
  for (const cat of allCategories) {
    if (!cat.userId) {
      catMap.set(cat.name, cat.id)
    }
  }

  const getCatId = (name: string): string => {
    const id = catMap.get(name) || catMap.get('Uncategorized')
    if (!id) {
      throw new Error(`Category "${name}" not found. Ensure categories are seeded.`)
    }
    return id
  }

  // 2. Verified Demo User
  const demoEmail = process.env['DEMO_USER_EMAIL'] || 'demo@momoney.io'
  const demoPassword = process.env['DEMO_USER_PASSWORD'] || 'password123'
  const demoName = process.env['DEMO_USER_NAME'] || 'Demo User'

  console.log(`👤 Setting up verified demo user: ${demoEmail}...`)

  // Check if existing demo user exists and clean up for idempotent re-runs
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, demoEmail),
  })

  if (existingUser) {
    console.log(`🧹 Removing existing demo user (${existingUser.id}) for a fresh seed...`)
    await db.delete(users).where(eq(users.id, existingUser.id))
  }

  // Insert user
  const [demoUser] = await db
    .insert(users)
    .values({
      email: demoEmail,
      name: demoName,
      emailVerified: true,
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    })
    .returning()

  if (!demoUser) {
    throw new Error('Failed to create demo user')
  }

  // Insert Better-Auth credential account
  const hashedPassword = await hashPassword(demoPassword)
  await db.insert(accounts).values({
    userId: demoUser.id,
    accountId: demoUser.id,
    providerId: 'credential',
    password: hashedPassword,
  })

  console.log(`✅ Demo user created and verified (ID: ${demoUser.id})`)

  // 3. 2 Owners (Husband and Wife)
  console.log('👥 Creating 2 Owners: Husband and Wife...')

  const [husbandOwner] = await db
    .insert(owners)
    .values({
      userId: demoUser.id,
      name: 'Husband',
      color: 'indigo',
      notes: 'Primary Earner & Investor',
      isDefault: true,
    })
    .returning()

  const [wifeOwner] = await db
    .insert(owners)
    .values({
      userId: demoUser.id,
      name: 'Wife',
      color: 'rose',
      notes: 'Designer & Co-Investor',
      isDefault: false,
    })
    .returning()

  if (!husbandOwner || !wifeOwner) {
    throw new Error('Failed to create owners')
  }
  console.log(`✅ Owners created: Husband (${husbandOwner.id}), Wife (${wifeOwner.id})`)

  // 4. Financial Accounts
  console.log('🏦 Creating Financial Accounts...')

  const [hdfcAccount] = await db
    .insert(financialAccounts)
    .values({
      userId: demoUser.id,
      accountName: 'HDFC Salary & Savings',
      accountType: 'bank',
      bankId: 'hdfc_savings',
      bankName: 'HDFC Bank',
      currency: 'INR',
    })
    .returning()

  const [iciciCard] = await db
    .insert(financialAccounts)
    .values({
      userId: demoUser.id,
      accountName: 'ICICI Sapphiro Credit Card',
      accountType: 'credit_card',
      bankId: 'icici_credit',
      bankName: 'ICICI Bank',
      currency: 'INR',
    })
    .returning()

  const [sbiJoint] = await db
    .insert(financialAccounts)
    .values({
      userId: demoUser.id,
      accountName: 'SBI Joint Household Savings',
      accountType: 'bank',
      bankId: 'hdfc_savings',
      bankName: 'State Bank of India',
      currency: 'INR',
    })
    .returning()

  if (!hdfcAccount || !iciciCard || !sbiJoint) {
    throw new Error('Failed to create financial accounts')
  }
  console.log('✅ Financial accounts created')

  // 5. Statements & Transactions (Past 3 Months)
  console.log('📄 Creating Statements and Transactions...')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth() // 0-based

  // Helper to format date YYYY-MM-01
  const formatMonth = (year: number, monthIdx: number) => {
    const d = new Date(year, monthIdx, 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}-01`
  }

  const month0 = formatMonth(currentYear, currentMonthIndex) // current
  const month1 = formatMonth(currentYear, currentMonthIndex - 1) // 1 month ago
  const month2 = formatMonth(currentYear, currentMonthIndex - 2) // 2 months ago

  // Create statements
  const [stmtHdfc0] = await db
    .insert(statements)
    .values({
      userId: demoUser.id,
      accountId: hdfcAccount.id,
      bankId: hdfcAccount.bankId,
      statementMonth: month0,
    })
    .returning()

  const [stmtHdfc1] = await db
    .insert(statements)
    .values({
      userId: demoUser.id,
      accountId: hdfcAccount.id,
      bankId: hdfcAccount.bankId,
      statementMonth: month1,
    })
    .returning()

  const [stmtHdfc2] = await db
    .insert(statements)
    .values({
      userId: demoUser.id,
      accountId: hdfcAccount.id,
      bankId: hdfcAccount.bankId,
      statementMonth: month2,
    })
    .returning()

  const [stmtIcici0] = await db
    .insert(statements)
    .values({
      userId: demoUser.id,
      accountId: iciciCard.id,
      bankId: iciciCard.bankId,
      statementMonth: month0,
    })
    .returning()

  const [stmtIcici1] = await db
    .insert(statements)
    .values({
      userId: demoUser.id,
      accountId: iciciCard.id,
      bankId: iciciCard.bankId,
      statementMonth: month1,
    })
    .returning()

  const monthsConfig = [
    {
      monthStr: month2,
      year: currentYear,
      monthIdx: currentMonthIndex - 2,
      hdfcStmt: stmtHdfc2!,
      iciciStmt: null,
    },
    {
      monthStr: month1,
      year: currentYear,
      monthIdx: currentMonthIndex - 1,
      hdfcStmt: stmtHdfc1!,
      iciciStmt: stmtIcici1!,
    },
    {
      monthStr: month0,
      year: currentYear,
      monthIdx: currentMonthIndex,
      hdfcStmt: stmtHdfc0!,
      iciciStmt: stmtIcici0!,
    },
  ]

  let totalTxnCount = 0

  for (const m of monthsConfig) {
    const d = (day: number) => new Date(m.year, m.monthIdx, day, 12, 0, 0)

    // Template of monthly transactions
    const monthlyTransactions: Array<{
      accountId: string
      statementId: string
      date: Date
      description: string
      merchant: string
      amount: number
      type: 'debit' | 'credit'
      categoryName: string
      isOneTime?: boolean
      comment?: string
      split: { husband: number; wife: number }
    }> = [
      // Incomes
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(1),
        description: 'SALARY/CLOUDSCALE SYSTEMS/NEFT CR',
        merchant: 'Salary',
        amount: 215000,
        type: 'credit',
        categoryName: 'Income',
        split: { husband: 100, wife: 0 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(1),
        description: 'SALARY/FINTECH INNOVATIONS/NEFT CR',
        merchant: 'Salary',
        amount: 150000,
        type: 'credit',
        categoryName: 'Income',
        split: { husband: 0, wife: 100 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(15),
        description: 'DIVIDEND/TCS/IMPS CR',
        merchant: 'Interest Income',
        amount: 4500,
        type: 'credit',
        categoryName: 'Income',
        split: { husband: 50, wife: 50 },
      },

      // Shared Living Expenses (50/50 Split)
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(2),
        description: 'NEFT TO LANDLORD RENT APARTMENT',
        merchant: 'Apartment Rent',
        amount: 45000,
        type: 'debit',
        categoryName: 'Utilities',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(3),
        description: 'UPI/NATURES BASKET/GROCERIES',
        merchant: 'Nature Basket',
        amount: 5240,
        type: 'debit',
        categoryName: 'Food & Dining',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(5),
        description: 'BESCOM ELECTRICITY BILL PAYMENT',
        merchant: 'BESCOM',
        amount: 2850,
        type: 'debit',
        categoryName: 'Utilities',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(6),
        description: 'AIRTEL FIBER BROADBAND BILL',
        merchant: 'Airtel',
        amount: 1180,
        type: 'debit',
        categoryName: 'Utilities',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(7),
        description: 'SWIGGY INSTAMART ESSENTIALS',
        merchant: 'Swiggy',
        amount: 1420,
        type: 'debit',
        categoryName: 'Food & Dining',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(12),
        description: 'ZOMATO DINNER ORDERING',
        merchant: 'Zomato',
        amount: 1650,
        type: 'debit',
        categoryName: 'Food & Dining',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(18),
        description: 'DOMINOS PIZZA WEEKEND',
        merchant: 'Dominos',
        amount: 890,
        type: 'debit',
        categoryName: 'Food & Dining',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(22),
        description: 'NETFLIX PREMIUM SUBSCRIPTION',
        merchant: 'Netflix',
        amount: 649,
        type: 'debit',
        categoryName: 'Subscriptions',
        split: { husband: 50, wife: 50 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(24),
        description: 'SPOTIFY FAMILY PLAN',
        merchant: 'Spotify',
        amount: 179,
        type: 'debit',
        categoryName: 'Subscriptions',
        split: { husband: 50, wife: 50 },
      },

      // Investments
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(5),
        description: 'ACH DEBIT PARAG PARIKH FLEXI CAP SIP',
        merchant: 'Parag Parikh MF',
        amount: 40000,
        type: 'debit',
        categoryName: 'Investments',
        split: { husband: 100, wife: 0 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(5),
        description: 'ACH DEBIT MIRAE ASSET LARGE CAP SIP',
        merchant: 'Mirae Asset MF',
        amount: 25000,
        type: 'debit',
        categoryName: 'Investments',
        split: { husband: 0, wife: 100 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(10),
        description: 'TRANSFER TO PUBLIC PROVIDENT FUND (PPF)',
        merchant: 'PPF Deposit',
        amount: 12500,
        type: 'debit',
        categoryName: 'Investments',
        split: { husband: 100, wife: 0 },
      },

      // Husband Personal Expenses (100% Husband)
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(8),
        description: 'SHELL PETROL STATION FUEL',
        merchant: 'Shell',
        amount: 3200,
        type: 'debit',
        categoryName: 'Transport',
        split: { husband: 100, wife: 0 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(14),
        description: 'UBER TRIP BANGALORE OFFICE',
        merchant: 'Uber',
        amount: 460,
        type: 'debit',
        categoryName: 'Transport',
        split: { husband: 100, wife: 0 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(20),
        description: 'GITHUB COPILOT SUBSCRIPTION',
        merchant: 'GitHub',
        amount: 820,
        type: 'debit',
        categoryName: 'Subscriptions',
        split: { husband: 100, wife: 0 },
      },

      // Wife Personal Expenses (100% Wife)
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(9),
        description: 'OLA CABS RIDE TO DESIGN STUDIO',
        merchant: 'Ola',
        amount: 380,
        type: 'debit',
        categoryName: 'Transport',
        split: { husband: 0, wife: 100 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(16),
        description: 'MYNTRA APPAREL & FOOTWEAR',
        merchant: 'Myntra',
        amount: 3450,
        type: 'debit',
        categoryName: 'Shopping',
        split: { husband: 0, wife: 100 },
      },
      {
        accountId: hdfcAccount.id,
        statementId: m.hdfcStmt.id,
        date: d(23),
        description: 'URBAN COMPANY SALON & SPA SERVICES',
        merchant: 'Urban Company',
        amount: 1800,
        type: 'debit',
        categoryName: 'Health',
        split: { husband: 0, wife: 100 },
      },
    ]

    // Credit Card Transactions if credit card statement exists
    if (m.iciciStmt) {
      monthlyTransactions.push(
        {
          accountId: iciciCard.id,
          statementId: m.iciciStmt.id,
          date: d(4),
          description: 'AMAZON INDIA ELECTRONICS & HOME',
          merchant: 'Amazon',
          amount: 4890,
          type: 'debit',
          categoryName: 'Shopping',
          split: { husband: 50, wife: 50 },
        },
        {
          accountId: iciciCard.id,
          statementId: m.iciciStmt.id,
          date: d(11),
          description: 'APOLLO PHARMACY HEALTHCARE',
          merchant: 'Apollo Pharmacy',
          amount: 1250,
          type: 'debit',
          categoryName: 'Health',
          split: { husband: 50, wife: 50 },
        },
        {
          accountId: iciciCard.id,
          statementId: m.iciciStmt.id,
          date: d(17),
          description: 'STARBUCKS COFFEE MEETUP',
          merchant: 'Starbucks',
          amount: 780,
          type: 'debit',
          categoryName: 'Food & Dining',
          split: { husband: 100, wife: 0 },
        },
        {
          accountId: iciciCard.id,
          statementId: m.iciciStmt.id,
          date: d(21),
          description: 'ZARA FASHION WEEKEND',
          merchant: 'Zara',
          amount: 6200,
          type: 'debit',
          categoryName: 'Shopping',
          isOneTime: true,
          split: { husband: 0, wife: 100 },
        }
      )
    }

    let parsedCount = 0
    let importedCount = 0

    for (const t of monthlyTransactions) {
      const dedupHash = computeDedupHash(t.accountId, t.date, t.amount, t.description, t.type)
      const catId = getCatId(t.categoryName)

      const [insertedTxn] = await db
        .insert(transactions)
        .values({
          userId: demoUser.id,
          accountId: t.accountId,
          statementId: t.statementId,
          date: t.date,
          description: t.description,
          merchant: t.merchant,
          amount: t.amount.toFixed(2),
          type: t.type,
          isOneTime: t.isOneTime ?? false,
          categoryId: catId,
          comment: t.comment ?? null,
          dedupHash,
        })
        .onConflictDoNothing()
        .returning()

      if (insertedTxn) {
        importedCount++
        totalTxnCount++

        // Add transaction owners split
        if (t.split.husband > 0) {
          const share = (t.amount * (t.split.husband / 100)).toFixed(2)
          await db.insert(transactionOwners).values({
            transactionId: insertedTxn.id,
            ownerId: husbandOwner.id,
            amount: share,
            percentage: t.split.husband.toFixed(2),
          })
        }

        if (t.split.wife > 0) {
          const share = (t.amount * (t.split.wife / 100)).toFixed(2)
          await db.insert(transactionOwners).values({
            transactionId: insertedTxn.id,
            ownerId: wifeOwner.id,
            amount: share,
            percentage: t.split.wife.toFixed(2),
          })
        }
      }
      parsedCount++
    }

    // Update statement counts
    await db
      .update(statements)
      .set({
        parsedCount,
        importedCount,
        duplicatesSkipped: parsedCount - importedCount,
      })
      .where(eq(statements.id, m.hdfcStmt.id))

    if (m.iciciStmt) {
      await db
        .update(statements)
        .set({
          parsedCount: 4,
          importedCount: 4,
          duplicatesSkipped: 0,
        })
        .where(eq(statements.id, m.iciciStmt.id))
    }
  }

  console.log(`✅ Inserted ${totalTxnCount} transactions across 5 statements with owner splits`)

  // 6. Net Worth: Assets, Liabilities, and 12-Month Snapshots
  console.log('📈 Seeding Net Worth Assets, Liabilities, and Snapshots...')

  // Live Assets - Husband
  await db.insert(assets).values([
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'Parag Parikh Flexi Cap Fund',
      type: 'mutual_fund',
      value: '1850000.00',
      currency: 'INR',
      equityDebtTag: 'equity',
      metadata: { investedAmount: 1400000 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'Nifty 50 Bluechip Equities',
      type: 'stock',
      value: '920000.00',
      currency: 'INR',
      equityDebtTag: 'equity',
      metadata: { quantity: 150, ltp: 6133.33 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'Employees Provident Fund (EPF & VPF)',
      type: 'ppf',
      value: '1200000.00',
      currency: 'INR',
      equityDebtTag: 'debt',
      metadata: { investedAmount: 1050000 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'HDFC Emergency Savings',
      type: 'savings_account',
      value: '450000.00',
      currency: 'INR',
      equityDebtTag: 'cash',
      metadata: {},
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: '2BHK Apartment (Whitefield, BLR)',
      type: 'real_estate',
      value: '9500000.00',
      currency: 'INR',
      equityDebtTag: 'equity',
      metadata: { purchasePrice: 8000000, purchaseYear: 2021 },
      valuationDate: now,
    },
  ])

  // Live Assets - Wife
  await db.insert(assets).values([
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'Mirae Asset Large Cap Fund',
      type: 'mutual_fund',
      value: '1480000.00',
      currency: 'INR',
      equityDebtTag: 'equity',
      metadata: { investedAmount: 1150000 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'SBI Tax Saver Fixed Deposit',
      type: 'fixed_deposit',
      value: '500000.00',
      currency: 'INR',
      equityDebtTag: 'debt',
      metadata: { investedAmount: 450000, interestRate: 7.1 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'Sovereign Gold Bonds (SGB 2021)',
      type: 'other',
      value: '620000.00',
      currency: 'INR',
      equityDebtTag: 'debt',
      metadata: { investedAmount: 450000 },
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'ICICI Savings Reserve',
      type: 'savings_account',
      value: '380000.00',
      currency: 'INR',
      equityDebtTag: 'cash',
      metadata: {},
      valuationDate: now,
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'Public Provident Fund (PPF)',
      type: 'ppf',
      value: '420000.00',
      currency: 'INR',
      equityDebtTag: 'debt',
      metadata: { investedAmount: 360000 },
      valuationDate: now,
    },
  ])

  // Live Liabilities
  await db.insert(liabilities).values([
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'HDFC Home Loan',
      type: 'home_loan',
      outstandingAmount: '4250000.00',
      interestRate: '8.50',
      monthlyPayment: '42000.00',
      lastUpdated: now,
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      name: 'ICICI Sapphiro Current Due',
      type: 'credit_card',
      outstandingAmount: '45000.00',
      interestRate: '0.00',
      monthlyPayment: '45000.00',
      lastUpdated: now,
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      name: 'ICICI EV Car Loan',
      type: 'car_loan',
      outstandingAmount: '620000.00',
      interestRate: '8.75',
      monthlyPayment: '15500.00',
      lastUpdated: now,
    },
  ])

  // Generate 12 Monthly Net Worth Snapshots for both Husband and Wife
  console.log('📊 Generating 12 months of Net Worth snapshots...')

  for (let i = 11; i >= 0; i--) {
    const snapDate = new Date(currentYear, currentMonthIndex - i, 1)
    const factor = 1 - (i * 0.02) // Gradual growth over 12 months

    // Husband Snapshot
    const hAssets = [
      { name: 'Mutual Funds', type: 'mutual_fund', value: Math.round(1850000 * factor), equityDebtTag: 'equity' },
      { name: 'Stocks', type: 'stock', value: Math.round(920000 * factor), equityDebtTag: 'equity' },
      { name: 'EPF & VPF', type: 'ppf', value: Math.round(1200000 * (1 - i * 0.015)), equityDebtTag: 'debt' },
      { name: 'Savings Cash', type: 'savings_account', value: Math.round(450000 * (1 + (i % 3) * 0.05)), equityDebtTag: 'cash' },
      { name: 'Real Estate', type: 'real_estate', value: 9500000, equityDebtTag: 'equity' },
    ]
    const hLiabs = [
      { name: 'HDFC Home Loan', type: 'home_loan', amount: Math.round(4250000 + i * 35000) },
      { name: 'Credit Card', type: 'credit_card', amount: Math.round(45000 + (i % 2) * 12000) },
    ]
    const hTotalAssets = hAssets.reduce((s, a) => s + a.value, 0)
    const hTotalLiabs = hLiabs.reduce((s, l) => s + l.amount, 0)
    const hNetWorth = hTotalAssets - hTotalLiabs

    await db.insert(netWorthSnapshots).values({
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      snapshotDate: snapDate,
      totalAssets: hTotalAssets.toFixed(2),
      totalLiabilities: hTotalLiabs.toFixed(2),
      netWorth: hNetWorth.toFixed(2),
      assetBreakdown: hAssets,
      liabilityBreakdown: hLiabs,
      notes: i === 0 ? 'Latest monthly snapshot' : undefined,
    })

    // Wife Snapshot
    const wAssets = [
      { name: 'Mutual Funds', type: 'mutual_fund', value: Math.round(1480000 * factor), equityDebtTag: 'equity' },
      { name: 'Fixed Deposit', type: 'fixed_deposit', value: 500000, equityDebtTag: 'debt' },
      { name: 'Gold Bonds (SGB)', type: 'other', value: Math.round(620000 * factor), equityDebtTag: 'debt' },
      { name: 'Savings Account', type: 'savings_account', value: Math.round(380000 * (1 + (i % 4) * 0.04)), equityDebtTag: 'cash' },
      { name: 'PPF', type: 'ppf', value: Math.round(420000 * (1 - i * 0.02)), equityDebtTag: 'debt' },
    ]
    const wLiabs = [
      { name: 'ICICI EV Car Loan', type: 'car_loan', amount: Math.round(620000 + i * 15000) },
    ]
    const wTotalAssets = wAssets.reduce((s, a) => s + a.value, 0)
    const wTotalLiabs = wLiabs.reduce((s, l) => s + l.amount, 0)
    const wNetWorth = wTotalAssets - wTotalLiabs

    await db.insert(netWorthSnapshots).values({
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      snapshotDate: snapDate,
      totalAssets: wTotalAssets.toFixed(2),
      totalLiabilities: wTotalLiabs.toFixed(2),
      netWorth: wNetWorth.toFixed(2),
      assetBreakdown: wAssets,
      liabilityBreakdown: wLiabs,
      notes: i === 0 ? 'Latest monthly snapshot' : undefined,
    })
  }

  console.log('✅ Net worth assets, liabilities, and 12-month historical snapshots seeded')

  // 7. Salary Growth for Both (Husband and Wife)
  console.log('💼 Seeding Salary Sources and Revisions (Career & Hike Growth)...')

  // Husband - Source 1 (Past)
  const [hSource1] = await db
    .insert(salarySources)
    .values({
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      companyName: 'Acme Tech Solutions',
      role: 'Senior Software Engineer',
      employmentType: 'full_time',
      currency: 'INR',
      startDate: new Date('2019-06-01'),
      endDate: new Date('2022-03-31'),
      status: 'past',
      notes: 'Initial high-growth engineering role',
    })
    .returning()

  await db.insert(salaryRevisions).values([
    {
      salarySourceId: hSource1!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2019-06-01'),
      annualCtc: '1200000.00',
      baseSalary: '900000.00',
      monthlyInHand: '85000.00',
      variablePay: '150000.00',
      stockGrant: '0.00',
      hikeType: 'joining',
      designation: 'Software Engineer',
      notes: 'Campus / Lateral joining compensation',
    },
    {
      salarySourceId: hSource1!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2020-04-01'),
      annualCtc: '1380000.00',
      baseSalary: '1035000.00',
      monthlyInHand: '97000.00',
      variablePay: '180000.00',
      stockGrant: '0.00',
      hikePercentage: '15.00',
      hikeType: 'annual_review',
      designation: 'Software Engineer II',
      notes: 'Strong performance rating (Exceeds Expectations)',
    },
    {
      salarySourceId: hSource1!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2021-04-01'),
      annualCtc: '1700000.00',
      baseSalary: '1250000.00',
      monthlyInHand: '120000.00',
      variablePay: '250000.00',
      stockGrant: '100000.00',
      hikePercentage: '23.19',
      hikeType: 'promotion',
      designation: 'Senior Software Engineer',
      notes: 'Promoted to Senior Engineer with tech lead responsibilities',
    },
  ])

  // Husband - Source 2 (Active)
  const [hSource2] = await db
    .insert(salarySources)
    .values({
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      companyName: 'CloudScale Systems',
      role: 'Principal Engineer',
      employmentType: 'full_time',
      currency: 'INR',
      startDate: new Date('2022-04-01'),
      status: 'active',
      notes: 'Series-B product scale engineering lead',
    })
    .returning()

  await db.insert(salaryRevisions).values([
    {
      salarySourceId: hSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2022-04-01'),
      annualCtc: '2400000.00',
      baseSalary: '1700000.00',
      monthlyInHand: '165000.00',
      variablePay: '300000.00',
      stockGrant: '200000.00',
      hikePercentage: '41.18',
      hikeType: 'joining',
      designation: 'Staff Software Engineer',
      notes: 'Job switch offer with equity component',
    },
    {
      salarySourceId: hSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2023-04-01'),
      annualCtc: '2750000.00',
      baseSalary: '1950000.00',
      monthlyInHand: '188000.00',
      variablePay: '350000.00',
      stockGrant: '300000.00',
      hikePercentage: '14.58',
      hikeType: 'annual_review',
      designation: 'Staff Software Engineer',
      notes: 'Annual merit appraisal',
    },
    {
      salarySourceId: hSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2024-04-01'),
      annualCtc: '3200000.00',
      baseSalary: '2250000.00',
      monthlyInHand: '215000.00',
      variablePay: '400000.00',
      stockGrant: '400000.00',
      hikePercentage: '16.36',
      hikeType: 'promotion',
      designation: 'Principal Engineer',
      notes: 'Promotion to Principal Engineer overseeing platform architecture',
    },
  ])

  // Wife - Source 1 (Past)
  const [wSource1] = await db
    .insert(salarySources)
    .values({
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      companyName: 'DesignCraft Studios',
      role: 'Product Designer',
      employmentType: 'full_time',
      currency: 'INR',
      startDate: new Date('2020-01-15'),
      endDate: new Date('2022-08-31'),
      status: 'past',
      notes: 'UI/UX design agency experience',
    })
    .returning()

  await db.insert(salaryRevisions).values([
    {
      salarySourceId: wSource1!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2020-01-15'),
      annualCtc: '900000.00',
      baseSalary: '750000.00',
      monthlyInHand: '65000.00',
      variablePay: '50000.00',
      stockGrant: '0.00',
      hikeType: 'joining',
      designation: 'Associate Product Designer',
      notes: 'Design studio onboarding',
    },
    {
      salarySourceId: wSource1!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2021-04-01'),
      annualCtc: '1050000.00',
      baseSalary: '875000.00',
      monthlyInHand: '75000.00',
      variablePay: '75000.00',
      stockGrant: '0.00',
      hikePercentage: '16.67',
      hikeType: 'annual_review',
      designation: 'Product Designer',
      notes: 'Annual increment',
    },
  ])

  // Wife - Source 2 (Active)
  const [wSource2] = await db
    .insert(salarySources)
    .values({
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      companyName: 'Fintech Innovations',
      role: 'Lead Product Designer',
      employmentType: 'full_time',
      currency: 'INR',
      startDate: new Date('2022-09-01'),
      status: 'active',
      notes: 'Leading customer experience & mobile app design',
    })
    .returning()

  await db.insert(salaryRevisions).values([
    {
      salarySourceId: wSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2022-09-01'),
      annualCtc: '1600000.00',
      baseSalary: '1300000.00',
      monthlyInHand: '112000.00',
      variablePay: '150000.00',
      stockGrant: '0.00',
      hikePercentage: '52.38',
      hikeType: 'joining',
      designation: 'Senior Product Designer',
      notes: 'Switch to in-house fintech unicorn',
    },
    {
      salarySourceId: wSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2023-04-01'),
      annualCtc: '1850000.00',
      baseSalary: '1500000.00',
      monthlyInHand: '128000.00',
      variablePay: '200000.00',
      stockGrant: '0.00',
      hikePercentage: '15.63',
      hikeType: 'annual_review',
      designation: 'Senior Product Designer',
      notes: 'Top tier evaluation & app revamp leadership',
    },
    {
      salarySourceId: wSource2!.id,
      userId: demoUser.id,
      effectiveDate: new Date('2024-04-01'),
      annualCtc: '2200000.00',
      baseSalary: '1750000.00',
      monthlyInHand: '150000.00',
      variablePay: '250000.00',
      stockGrant: '100000.00',
      hikePercentage: '18.92',
      hikeType: 'promotion',
      designation: 'Lead Product Designer',
      notes: 'Promoted to Lead Product Designer leading a team of 4 designers',
    },
  ])

  console.log('✅ Salary sources and revisions created for both Husband and Wife')

  // 8. Income Tax Filing History for Both (Financial Year Incomes)
  console.log('📑 Seeding Income Tax Filing History (FY 2020-21 through FY 2024-25)...')

  // Husband Tax Filing History
  await db.insert(financialYearIncomes).values([
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      financialYear: 'FY 2020-21',
      grossIncome: '1350000.00',
      taxPaid: '185000.00',
      netIncome: '1165000.00',
      breakdown: { salary: 1300000, investments: 50000 },
      notes: 'ITR-1 filed. Old tax regime with 80C deductions.',
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      financialYear: 'FY 2021-22',
      grossIncome: '1720000.00',
      taxPaid: '275000.00',
      netIncome: '1445000.00',
      breakdown: { salary: 1650000, investments: 70000 },
      notes: 'ITR-2 filed. HRA, home loan interest, and 80C claimed.',
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      financialYear: 'FY 2022-23',
      grossIncome: '2480000.00',
      taxPaid: '490000.00',
      netIncome: '1990000.00',
      breakdown: { salary: 2350000, bonus: 80000, investments: 50000 },
      notes: 'ITR-2 filed. Switched to CloudScale Systems with joining bonus.',
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      financialYear: 'FY 2023-24',
      grossIncome: '2850000.00',
      taxPaid: '580000.00',
      netIncome: '2270000.00',
      breakdown: { salary: 2680000, investments: 120000, freelance: 50000 },
      notes: 'ITR-2 verified. Transitioned to New Tax Regime.',
    },
    {
      userId: demoUser.id,
      ownerId: husbandOwner.id,
      financialYear: 'FY 2024-25',
      grossIncome: '3320000.00',
      taxPaid: '695000.00',
      netIncome: '2625000.00',
      breakdown: { salary: 3100000, bonus: 150000, investments: 70000 },
      notes: 'Estimated FY 2024-25 with advance tax and TDS on track.',
    },
  ])

  // Wife Tax Filing History
  await db.insert(financialYearIncomes).values([
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      financialYear: 'FY 2020-21',
      grossIncome: '920000.00',
      taxPaid: '95000.00',
      netIncome: '825000.00',
      breakdown: { salary: 900000, investments: 20000 },
      notes: 'ITR-1 filed. DesignCraft Studios.',
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      financialYear: 'FY 2021-22',
      grossIncome: '1080000.00',
      taxPaid: '125000.00',
      netIncome: '955000.00',
      breakdown: { salary: 1040000, investments: 40000 },
      notes: 'ITR-1 filed. 80C PPF deductions utilized.',
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      financialYear: 'FY 2022-23',
      grossIncome: '1540000.00',
      taxPaid: '235000.00',
      netIncome: '1305000.00',
      breakdown: { salary: 1480000, freelance: 60000 },
      notes: 'ITR-2 filed. Joined Fintech Innovations with freelance UI projects.',
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      financialYear: 'FY 2023-24',
      grossIncome: '1910000.00',
      taxPaid: '330000.00',
      netIncome: '1580000.00',
      breakdown: { salary: 1820000, investments: 90000 },
      notes: 'ITR-1 filed under New Tax Regime.',
    },
    {
      userId: demoUser.id,
      ownerId: wifeOwner.id,
      financialYear: 'FY 2024-25',
      grossIncome: '2280000.00',
      taxPaid: '415000.00',
      netIncome: '1865000.00',
      breakdown: { salary: 2150000, investments: 80000, freelance: 50000 },
      notes: 'Current FY estimate with promotion compensation.',
    },
  ])

  console.log('✅ Income tax filing history seeded for both Husband and Wife')

  // Print Summary
  console.log('\n=============================================================')
  console.log('🎉 MoMoney Demo Database Seeded Successfully!')
  console.log('=============================================================')
  console.log(`👤 Verified User:     ${demoEmail}`)
  console.log(`🔑 Password:          ${demoPassword}`)
  console.log(`👥 Household Owners:  Husband (indigo, default), Wife (rose)`)
  console.log(`🏦 Financial Accounts: 3 accounts (HDFC, ICICI Card, SBI Joint)`)
  console.log(`📄 Statements:        5 statements across last 3 months`)
  console.log(`💳 Transactions:      ${totalTxnCount} transactions with category & owner splits`)
  console.log(`📈 Net Worth Assets:  10 assets + 3 liabilities + 12 monthly snapshots for both`)
  console.log(`💼 Salary Growth:     4 salary sources + 11 revisions with hikes & promotions`)
  console.log(`📑 Tax Filing (FY):   5 financial years (FY 2020-21 to 2024-25) for both`)
  console.log('=============================================================\n')
}

import path from 'node:path'

const isMain =
  process.argv[1] &&
  (path.basename(process.argv[1]) === 'demo-seed.ts' || path.basename(process.argv[1]) === 'demo-seed.js')
if (isMain) {
  seedDemo()
    .then(async () => {
      if (rawPgSql) {
        await rawPgSql.end()
      }
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ Demo seeding failed:', err)
      process.exit(1)
    })
}

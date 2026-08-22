import { Hono } from 'hono'
import { db } from '@momoney/db'
import {
  assets,
  liabilities,
  netWorthSnapshots,
  netWorthDrafts,
  owners,
} from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc, asc, sum, or, isNull } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { resolveAssetTag } from '@momoney/utils'

export const networthRoute = new Hono<{
  Variables: { userId: string }
}>()

networthRoute.use('*', authMiddleware)

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const insertAssetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum([
    'mutual_fund', 'stock', 'fixed_deposit', 'recurring_deposit', 'ppf', 'savings_account', 'real_estate', 'crypto', 'cash', 'other'
  ]),
  value: z.number().nonnegative('Value must be non-negative'),
  currency: z.string().default('INR'),
  valuationDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  metadata: z.record(z.any()).default({}),
  ownerId: z.string().uuid().optional().nullable(),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.type === 'stock') {
    if (typeof data.metadata.quantity !== 'number' || typeof data.metadata.ltp !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Stock reqs quantity and ltp', path: ['metadata'] })
    }
  } else if (data.type === 'mutual_fund') {
    if (typeof data.metadata.investedAmount !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mutual Fund reqs investedAmount', path: ['metadata'] })
    }
  } else if (['fixed_deposit', 'recurring_deposit', 'ppf'].includes(data.type)) {
     if (typeof data.metadata.investedAmount !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deposit reqs investedAmount', path: ['metadata'] })
    }
  }
})

const updateAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  type: z.enum([
    'mutual_fund', 'stock', 'fixed_deposit', 'recurring_deposit', 'ppf', 'savings_account', 'real_estate', 'crypto', 'cash', 'other'
  ]).optional(),
  value: z.number().nonnegative('Value must be non-negative').optional(),
  currency: z.string().optional(),
  valuationDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date').optional(),
  metadata: z.record(z.any()).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  equityDebtTag: z.enum(['equity', 'debt', 'mixed', 'cash']).optional().nullable(),
})

const insertLiabilitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['home_loan', 'car_loan', 'credit_card', 'student_loan', 'personal_loan', 'other']),
  outstandingAmount: z.number().nonnegative('Amount must be non-negative'),
  interestRate: z.number().nonnegative().optional(),
  monthlyPayment: z.number().nonnegative().optional(),
  ownerId: z.string().uuid().optional().nullable(),
})

const updateLiabilitySchema = insertLiabilitySchema.partial()

const draftSchema = z.object({
  assetBreakdown: z.array(z.record(z.any())).optional(),
  liabilityBreakdown: z.array(z.record(z.any())).optional(),
})

// ─── Helper: compute live net worth ──────────────────────────────────────────

async function computeLiveNetWorth(userId: string, ownerId?: string | null) {
  const defaultOwner = await db.query.owners.findFirst({
    where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
  })

  let assetWhereClause
  let liabilityWhereClause

  if (ownerId && ownerId !== 'all') {
    if (defaultOwner && ownerId === defaultOwner.id) {
      assetWhereClause = and(
        eq(assets.userId, userId),
        or(eq(assets.ownerId, ownerId), isNull(assets.ownerId))
      )
      liabilityWhereClause = and(
        eq(liabilities.userId, userId),
        or(eq(liabilities.ownerId, ownerId), isNull(liabilities.ownerId))
      )
    } else {
      assetWhereClause = and(eq(assets.userId, userId), eq(assets.ownerId, ownerId))
      liabilityWhereClause = and(eq(liabilities.userId, userId), eq(liabilities.ownerId, ownerId))
    }
  } else {
    assetWhereClause = eq(assets.userId, userId)
    liabilityWhereClause = eq(liabilities.userId, userId)
  }

  const userAssets = await db.query.assets.findMany({
    where: assetWhereClause,
    orderBy: [asc(assets.type), asc(assets.createdAt)],
  })
  const userLiabilities = await db.query.liabilities.findMany({
    where: liabilityWhereClause,
    orderBy: [asc(liabilities.type), asc(liabilities.createdAt)],
  })

  const totalAssets = userAssets.reduce((sum, a) => sum + parseFloat(a.value as string), 0)
  const totalLiabilities = userLiabilities.reduce(
    (sum, l) => sum + parseFloat(l.outstandingAmount as string),
    0
  )

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assets: userAssets,
    liabilities: userLiabilities,
  }
}

// ─── GET /v1/networth — live net worth ────────────────────────────────────────

networthRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.query('ownerId')
  const data = await computeLiveNetWorth(userId, ownerId)
  return c.json({ success: true, data })
})

// ─── GET /v1/networth/history ────────────────────────────────────────────────

networthRoute.get('/history', async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.query('ownerId')

  let snapshots
  if (ownerId && ownerId !== 'all') {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    
    if (defaultOwner && ownerId === defaultOwner.id) {
      snapshots = await db.query.netWorthSnapshots.findMany({
        where: and(
          eq(netWorthSnapshots.userId, userId),
          or(eq(netWorthSnapshots.ownerId, ownerId), isNull(netWorthSnapshots.ownerId))
        ),
        with: {
          owner: true,
        },
        orderBy: [asc(netWorthSnapshots.snapshotDate)],
      })
    } else {
      snapshots = await db.query.netWorthSnapshots.findMany({
        where: and(
          eq(netWorthSnapshots.userId, userId),
          eq(netWorthSnapshots.ownerId, ownerId)
        ),
        with: {
          owner: true,
        },
        orderBy: [asc(netWorthSnapshots.snapshotDate)],
      })
    }
  } else {
    // Return all snapshots with their owner relations
    snapshots = await db.query.netWorthSnapshots.findMany({
      where: eq(netWorthSnapshots.userId, userId),
      with: {
        owner: true,
      },
      orderBy: [asc(netWorthSnapshots.snapshotDate)],
    })
  }
  return c.json({ success: true, data: snapshots })
})

// ─── POST /v1/networth/snapshot — save snapshot for current month ─────────────

networthRoute.post('/snapshot', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  let ownerId = body.ownerId || c.req.query('ownerId')
  if (!ownerId) {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    ownerId = defaultOwner?.id
  }

  const { totalAssets, totalLiabilities, netWorth, assets: userAssets, liabilities: userLiabilities } =
    await computeLiveNetWorth(userId, ownerId)

  // Snapshot date = start of specified day or current day
  const now = new Date()
  let snapshotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (body.date) {
    const parsed = new Date(body.date)
    if (!isNaN(parsed.getTime())) {
      snapshotDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    }
  }

  const assetBreakdown = userAssets.map((a) => ({
    name: a.name,
    type: a.type as string,
    value: parseFloat(a.value as string),
    metadata: a.metadata,
    equityDebtTag: resolveAssetTag(a.type as string, a.metadata, a.equityDebtTag as any),
  }))
  const liabilityBreakdown = userLiabilities.map((l) => ({
    name: l.name,
    type: l.type,
    amount: parseFloat(l.outstandingAmount as string),
    interestRate: l.interestRate ? parseFloat(l.interestRate as string) : undefined,
    monthlyPayment: l.monthlyPayment ? parseFloat(l.monthlyPayment as string) : undefined,
  }))

  // Upsert — if snapshot for this month already exists for this owner, replace it
  const existing = await db.query.netWorthSnapshots.findFirst({
    where: and(
      eq(netWorthSnapshots.userId, userId),
      eq(netWorthSnapshots.ownerId, ownerId),
      eq(netWorthSnapshots.snapshotDate, snapshotDate)
    ),
  })

  let snapshot
  if (existing) {
    ;[snapshot] = await db
      .update(netWorthSnapshots)
      .set({
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netWorth: netWorth.toFixed(2),
        assetBreakdown,
        liabilityBreakdown,
      })
      .where(eq(netWorthSnapshots.id, existing.id))
      .returning()
  } else {
    ;[snapshot] = await db
      .insert(netWorthSnapshots)
      .values({
        userId,
        ownerId,
        snapshotDate,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netWorth: netWorth.toFixed(2),
        assetBreakdown,
        liabilityBreakdown,
      })
      .returning()
  }

  // Auto-clear draft after successful snapshot
  await db.delete(netWorthDrafts).where(
    and(eq(netWorthDrafts.userId, userId), eq(netWorthDrafts.ownerId, ownerId))
  )

  return c.json({ success: true, data: snapshot }, existing ? 200 : 201)
})

// ─── POST /v1/networth/snapshot/:id/copy — copy old snapshot into live rows ───

networthRoute.post('/snapshot/:id/copy', async (c) => {
  const userId = c.get('userId')
  const snapshotId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { adjustedAssets, adjustedLiabilities } = body

  const snapshot = await db.query.netWorthSnapshots.findFirst({
    where: and(eq(netWorthSnapshots.id, snapshotId), eq(netWorthSnapshots.userId, userId)),
  })

  if (!snapshot) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Snapshot not found' } }, 404)
  }

  const ownerId = snapshot.ownerId

  // Clear all current assets and liabilities for user and owner
  let deleteAssetWhereClause
  let deleteLiabilityWhereClause
  
  const defaultOwner = await db.query.owners.findFirst({
    where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
  })
  
  if (!defaultOwner) {
    return c.json({ success: false, error: { message: 'Default owner not found' } }, 400)
  }
  
  if (ownerId) {
    if (ownerId === defaultOwner.id) {
      deleteAssetWhereClause = and(eq(assets.userId, userId), or(eq(assets.ownerId, ownerId), isNull(assets.ownerId)))
      deleteLiabilityWhereClause = and(eq(liabilities.userId, userId), or(eq(liabilities.ownerId, ownerId), isNull(liabilities.ownerId)))
    } else {
      deleteAssetWhereClause = and(eq(assets.userId, userId), eq(assets.ownerId, ownerId))
      deleteLiabilityWhereClause = and(eq(liabilities.userId, userId), eq(liabilities.ownerId, ownerId))
    }
  } else {
    const targetOwnerId = defaultOwner.id
    deleteAssetWhereClause = and(eq(assets.userId, userId), or(eq(assets.ownerId, targetOwnerId), isNull(assets.ownerId)))
    deleteLiabilityWhereClause = and(eq(liabilities.userId, userId), or(eq(liabilities.ownerId, targetOwnerId), isNull(liabilities.ownerId)))
  }

  await db.delete(assets).where(deleteAssetWhereClause)
  await db.delete(liabilities).where(deleteLiabilityWhereClause)

  // Re-insert from snapshot breakdown
  const today = new Date()
  const targetOwnerId = ownerId || defaultOwner.id

  if (adjustedAssets && adjustedAssets.length > 0) {
    const assetValues = adjustedAssets.map((a: any) => ({
      userId,
      ownerId: targetOwnerId,
      name: a.name,
      type: a.type as any,
      value: a.value.toFixed(2),
      equityDebtTag: a.equityDebtTag || undefined,
      metadata: a.metadata ?? {},
      currency: 'INR',
      valuationDate: today,
    }))
    await db.insert(assets).values(assetValues)
  } else if (snapshot.assetBreakdown && snapshot.assetBreakdown.length > 0) {
    const assetValues = snapshot.assetBreakdown.map((a) => ({
      userId,
      ownerId: targetOwnerId,
      name: a.name,
      type: a.type as any,
      value: a.value.toFixed(2),
      equityDebtTag: (a as any).equityDebtTag || undefined,
      metadata: (a as any).metadata ?? {},
      currency: 'INR',
      valuationDate: today,
    }))
    await db.insert(assets).values(assetValues)
  }

  if (adjustedLiabilities && adjustedLiabilities.length > 0) {
    const liabilityValues = adjustedLiabilities.map((l: any) => ({
      userId,
      ownerId: targetOwnerId,
      name: l.name,
      type: l.type as any,
      outstandingAmount: l.outstandingAmount.toFixed(2),
      interestRate: l.interestRate !== undefined ? l.interestRate.toFixed(2) : undefined,
      monthlyPayment: l.monthlyPayment !== undefined ? l.monthlyPayment.toFixed(2) : undefined,
      lastUpdated: today,
    }))
    await db.insert(liabilities).values(liabilityValues)
  } else if (snapshot.liabilityBreakdown && snapshot.liabilityBreakdown.length > 0) {
    const liabilityValues = snapshot.liabilityBreakdown.map((l) => ({
      userId,
      ownerId: targetOwnerId,
      name: l.name,
      type: l.type as any,
      outstandingAmount: (l as any).amount?.toFixed(2) ?? '0',
      interestRate: (l as any).interestRate?.toFixed(2),
      monthlyPayment: (l as any).monthlyPayment?.toFixed(2),
      lastUpdated: today,
    }))
    await db.insert(liabilities).values(liabilityValues)
  }

  const data = await computeLiveNetWorth(userId, targetOwnerId)
  return c.json({ success: true, data })
})

// ─── DELETE /v1/networth/snapshot/:id — delete past snapshot ──────────────────

networthRoute.delete('/snapshot/:id', async (c) => {
  const userId = c.get('userId')
  const snapshotId = c.req.param('id')

  const [snapshot] = await db
    .delete(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.id, snapshotId), eq(netWorthSnapshots.userId, userId)))
    .returning()

  if (!snapshot) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Snapshot not found' } }, 404)
  }

  return c.json({ success: true, data: null })
})

// ─── GET /v1/networth/draft ───────────────────────────────────────────────────

networthRoute.get('/draft', async (c) => {
  const userId = c.get('userId')
  let ownerId = c.req.query('ownerId')
  if (!ownerId) {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    ownerId = defaultOwner?.id
  }
  if (!ownerId) {
    return c.json({ success: false, error: { message: 'Owner ID not found' } }, 400)
  }
  const draft = await db.query.netWorthDrafts.findFirst({
    where: and(eq(netWorthDrafts.userId, userId), eq(netWorthDrafts.ownerId, ownerId)),
  })
  return c.json({ success: true, data: draft ?? null })
})

// ─── PUT /v1/networth/draft ───────────────────────────────────────────────────

networthRoute.put('/draft', zValidator('json', draftSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')
  let ownerId = c.req.query('ownerId')
  if (!ownerId) {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    ownerId = defaultOwner?.id
  }
  if (!ownerId) {
    return c.json({ success: false, error: { message: 'Owner ID not found' } }, 400)
  }

  // Get current live state if no breakdown provided
  const { assets: userAssets, liabilities: userLiabilities } = await computeLiveNetWorth(userId, ownerId)

  const assetBreakdown =
    body.assetBreakdown ??
    userAssets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: parseFloat(a.value as string),
      currency: a.currency,
      equityDebtTag: a.equityDebtTag || undefined,
      metadata: a.metadata,
      valuationDate: (a.valuationDate as Date).toISOString().split('T')[0],
    }))

  const liabilityBreakdown =
    body.liabilityBreakdown ??
    userLiabilities.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      outstandingAmount: parseFloat(l.outstandingAmount as string),
      interestRate: l.interestRate ? parseFloat(l.interestRate as string) : undefined,
      monthlyPayment: l.monthlyPayment ? parseFloat(l.monthlyPayment as string) : undefined,
    }))

  const cleanAssetBreakdown = assetBreakdown.map(a => {
    const { id, ...rest } = a;
    return id ? a : rest;
  })

  const cleanLiabilityBreakdown = liabilityBreakdown.map(l => {
    const { id, ...rest } = l;
    return id ? l : rest;
  })

  // Upsert draft (unique on ownerId)
  const existing = await db.query.netWorthDrafts.findFirst({
    where: and(eq(netWorthDrafts.userId, userId), eq(netWorthDrafts.ownerId, ownerId)),
  })

  let draft
  if (existing) {
    ;[draft] = await db
      .update(netWorthDrafts)
      .set({ assetBreakdown: cleanAssetBreakdown, liabilityBreakdown: cleanLiabilityBreakdown, savedAt: new Date() })
      .where(and(eq(netWorthDrafts.userId, userId), eq(netWorthDrafts.ownerId, ownerId)))
      .returning()
  } else {
    ;[draft] = await db
      .insert(netWorthDrafts)
      .values({ userId, ownerId, assetBreakdown: cleanAssetBreakdown, liabilityBreakdown: cleanLiabilityBreakdown })
      .returning()
  }

  return c.json({ success: true, data: draft })
})

// ─── DELETE /v1/networth/draft ────────────────────────────────────────────────

networthRoute.delete('/draft', async (c) => {
  const userId = c.get('userId')
  let ownerId = c.req.query('ownerId')
  if (!ownerId) {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    ownerId = defaultOwner?.id
  }
  if (!ownerId) {
    return c.json({ success: false, error: { message: 'Owner ID not found' } }, 400)
  }
  await db.delete(netWorthDrafts).where(
    and(eq(netWorthDrafts.userId, userId), eq(netWorthDrafts.ownerId, ownerId))
  )
  return c.json({ success: true, data: null })
})

// ─── ASSETS CRUD ──────────────────────────────────────────────────────────────

networthRoute.get('/assets', async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.query('ownerId')
  
  let assetWhereClause
  if (ownerId && ownerId !== 'all') {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    if (defaultOwner && ownerId === defaultOwner.id) {
      assetWhereClause = and(eq(assets.userId, userId), or(eq(assets.ownerId, ownerId), isNull(assets.ownerId)))
    } else {
      assetWhereClause = and(eq(assets.userId, userId), eq(assets.ownerId, ownerId))
    }
  } else {
    assetWhereClause = eq(assets.userId, userId)
  }

  const data = await db.query.assets.findMany({
    where: assetWhereClause,
    orderBy: [asc(assets.type), asc(assets.createdAt)],
  })
  return c.json({ success: true, data })
})

networthRoute.post('/assets', zValidator('json', insertAssetSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const tag = resolveAssetTag(body.type, body.metadata, body.equityDebtTag)

  const [asset] = await db
    .insert(assets)
    .values({
      userId,
      ownerId: body.ownerId,
      name: body.name,
      type: body.type,
      value: body.value.toFixed(2),
      equityDebtTag: tag,
      metadata: body.metadata,
      currency: body.currency,
      valuationDate: new Date(body.valuationDate),
    })
    .returning()

  return c.json({ success: true, data: asset }, 201)
})

networthRoute.patch('/assets/:id', zValidator('json', updateAssetSchema), async (c) => {
  const userId = c.get('userId')
  const assetId = c.req.param('id')
  const body = c.req.valid('json')

  const updateData: Record<string, any> = { updatedAt: new Date() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.type !== undefined) updateData.type = body.type
  if (body.value !== undefined) updateData.value = body.value.toFixed(2)
  if (body.currency !== undefined) updateData.currency = body.currency
  if (body.metadata !== undefined) updateData.metadata = body.metadata
  if (body.valuationDate !== undefined) updateData.valuationDate = new Date(body.valuationDate)
  if (body.ownerId !== undefined) updateData.ownerId = body.ownerId
  if (body.equityDebtTag !== undefined) updateData.equityDebtTag = body.equityDebtTag

  const [asset] = await db
    .update(assets)
    .set(updateData)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .returning()

  if (!asset) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } }, 404)
  }

  return c.json({ success: true, data: asset })
})

networthRoute.delete('/assets/:id', async (c) => {
  const userId = c.get('userId')
  const assetId = c.req.param('id')

  const [asset] = await db
    .delete(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .returning()

  if (!asset) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } }, 404)
  }

  return c.json({ success: true, data: null })
})

// ─── LIABILITIES CRUD ─────────────────────────────────────────────────────────

networthRoute.get('/liabilities', async (c) => {
  const userId = c.get('userId')
  const ownerId = c.req.query('ownerId')

  let liabilityWhereClause
  if (ownerId && ownerId !== 'all') {
    const defaultOwner = await db.query.owners.findFirst({
      where: and(eq(owners.userId, userId), eq(owners.isDefault, true))
    })
    if (defaultOwner && ownerId === defaultOwner.id) {
      liabilityWhereClause = and(eq(liabilities.userId, userId), or(eq(liabilities.ownerId, ownerId), isNull(liabilities.ownerId)))
    } else {
      liabilityWhereClause = and(eq(liabilities.userId, userId), eq(liabilities.ownerId, ownerId))
    }
  } else {
    liabilityWhereClause = eq(liabilities.userId, userId)
  }

  const data = await db.query.liabilities.findMany({
    where: liabilityWhereClause,
    orderBy: [asc(liabilities.type), asc(liabilities.createdAt)],
  })
  return c.json({ success: true, data })
})

networthRoute.post('/liabilities', zValidator('json', insertLiabilitySchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [liability] = await db
    .insert(liabilities)
    .values({
      userId,
      ownerId: body.ownerId,
      name: body.name,
      type: body.type,
      outstandingAmount: body.outstandingAmount.toFixed(2),
      interestRate: body.interestRate !== undefined ? body.interestRate.toFixed(2) : undefined,
      monthlyPayment: body.monthlyPayment !== undefined ? body.monthlyPayment.toFixed(2) : undefined,
      lastUpdated: new Date(),
    })
    .returning()

  return c.json({ success: true, data: liability }, 201)
})

networthRoute.patch('/liabilities/:id', zValidator('json', updateLiabilitySchema), async (c) => {
  const userId = c.get('userId')
  const liabilityId = c.req.param('id')
  const body = c.req.valid('json')

  const updateData: Record<string, any> = { lastUpdated: new Date() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.type !== undefined) updateData.type = body.type
  if (body.outstandingAmount !== undefined) updateData.outstandingAmount = body.outstandingAmount.toFixed(2)
  if (body.interestRate !== undefined) updateData.interestRate = body.interestRate.toFixed(2)
  if (body.monthlyPayment !== undefined) updateData.monthlyPayment = body.monthlyPayment.toFixed(2)
  if (body.ownerId !== undefined) updateData.ownerId = body.ownerId

  const [liability] = await db
    .update(liabilities)
    .set(updateData)
    .where(and(eq(liabilities.id, liabilityId), eq(liabilities.userId, userId)))
    .returning()

  if (!liability) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Liability not found' } },
      404
    )
  }

  return c.json({ success: true, data: liability })
})

networthRoute.delete('/liabilities/:id', async (c) => {
  const userId = c.get('userId')
  const liabilityId = c.req.param('id')

  const [liability] = await db
    .delete(liabilities)
    .where(and(eq(liabilities.id, liabilityId), eq(liabilities.userId, userId)))
    .returning()

  if (!liability) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Liability not found' } },
      404
    )
  }

  return c.json({ success: true, data: null })
})

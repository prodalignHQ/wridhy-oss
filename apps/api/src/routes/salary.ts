import { Hono } from 'hono'
import { db } from '@momoney/db'
import { salarySources, salaryRevisions, owners } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc, asc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const salaryRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

salaryRoute.use('*', authMiddleware)

const hikeTypeEnum = z.enum([
  'joining',
  'annual_review',
  'mid_year_hike',
  'promotion',
  'market_correction',
  'retention',
  'other',
])

const employmentTypeEnum = z.enum(['full_time', 'part_time', 'contract', 'freelance', 'internship'])

const createSourceSchema = z.object({
  ownerId: z.string().uuid().nullable().optional(),
  companyName: z.string().min(1, 'Company name is required'),
  role: z.string().min(1, 'Role / Designation is required'),
  employmentType: employmentTypeEnum.default('full_time'),
  currency: z.string().default('INR'),
  startDate: z.string().min(1, 'Valid start date is required'),
  endDate: z.string().min(1, 'Invalid end date').nullable().optional(),
  status: z.enum(['active', 'past']).default('active'),
  notes: z.string().nullable().optional(),
  initialAnnualCtc: z.number().positive('Initial CTC must be greater than 0').optional(),
  initialBaseSalary: z.number().nonnegative().optional(),
  initialMonthlyInHand: z.number().nonnegative().optional(),
  initialVariablePay: z.number().nonnegative().optional(),
  initialStockGrant: z.number().nonnegative().optional(),
})

const updateSourceSchema = z.object({
  ownerId: z.string().uuid().nullable().optional(),
  companyName: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  employmentType: employmentTypeEnum.optional(),
  currency: z.string().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).nullable().optional(),
  status: z.enum(['active', 'past']).optional(),
  notes: z.string().nullable().optional(),
})

const createRevisionSchema = z.object({
  salarySourceId: z.string().uuid('Valid salary source ID is required'),
  effectiveDate: z.string().min(1, 'Valid effective date is required'),
  annualCtc: z.number().positive('Annual CTC must be greater than 0'),
  baseSalary: z.number().nonnegative().optional(),
  monthlyInHand: z.number().nonnegative().optional(),
  variablePay: z.number().nonnegative().optional(),
  stockGrant: z.number().nonnegative().optional(),
  hikePercentage: z.number().optional(),
  hikeType: hikeTypeEnum.default('annual_review'),
  designation: z.string().optional(),
  notes: z.string().optional(),
})

const updateRevisionSchema = z.object({
  effectiveDate: z.string().min(1).optional(),
  annualCtc: z.number().positive('Annual CTC must be greater than 0').optional(),
  baseSalary: z.number().nonnegative().optional(),
  monthlyInHand: z.number().nonnegative().optional(),
  variablePay: z.number().nonnegative().optional(),
  stockGrant: z.number().nonnegative().optional(),
  hikePercentage: z.number().optional(),
  hikeType: hikeTypeEnum.optional(),
  designation: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * Calculates exact annualized growth rate (CAGR) between two compensation points.
 * Uses exact day count for irregular dates: ((endVal / startVal) ^ (365.25 / days) - 1) * 100
 */
export function calculateAnnualizedGrowth(startVal: number, endVal: number, days: number): number | null {
  if (startVal <= 0 || endVal <= 0 || days <= 0) return null
  // Avoid extreme mathematical distortion for tiny intervals (< 7 days)
  if (days < 7) return null
  const years = days / 365.25
  const rate = (Math.pow(endVal / startVal, 1 / years) - 1) * 100
  if (!isFinite(rate) || isNaN(rate)) return null
  return parseFloat(rate.toFixed(1))
}

// GET /v1/salary/sources - list all sources and their revisions
salaryRoute.get('/sources', async (c) => {
  const userId = c.get('userId')
  const ownerIdParam = c.req.query('ownerId')

  const conditions = [eq(salarySources.userId, userId)]
  if (ownerIdParam && ownerIdParam !== 'all') {
    conditions.push(eq(salarySources.ownerId, ownerIdParam))
  }

  const sources = await db.query.salarySources.findMany({
    where: and(...conditions),
    with: {
      owner: true,
      revisions: {
        orderBy: (rev, { asc }) => [asc(rev.effectiveDate)],
      },
    },
    orderBy: (s, { desc }) => [desc(s.startDate)],
  })

  const now = new Date()

  // Enrich each source with current CTC, hike info, etc.
  const enrichedSources = sources.map((source) => {
    const revs = source.revisions || []
    const sortedRevs = [...revs].sort(
      (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    )

    // Calculate hike differences between successive revisions
    const enrichedRevisions = sortedRevs.map((rev, index) => {
      const ctc = parseFloat(rev.annualCtc) || 0
      const base = parseFloat(rev.baseSalary || '0') || 0
      const monthly = parseFloat(rev.monthlyInHand || '0') || Math.round(ctc / 12)
      const variable = parseFloat(rev.variablePay || '0') || 0
      const stock = parseFloat(rev.stockGrant || '0') || 0

      let calculatedHikePercentage: number | null = null
      let hikeAmount = 0
      let monthsSinceLastRevision: number | null = null
      let hikeCagr: number | null = null
      let cumulativeCagr: number | null = null

      if (index > 0) {
        const prevRev = sortedRevs[index - 1]!
        const prevCtc = parseFloat(prevRev.annualCtc) || 0
        hikeAmount = ctc - prevCtc
        if (prevCtc > 0) {
          calculatedHikePercentage = parseFloat((((ctc - prevCtc) / prevCtc) * 100).toFixed(2))
        }
        const diffMs = new Date(rev.effectiveDate).getTime() - new Date(prevRev.effectiveDate).getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)
        monthsSinceLastRevision = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375))

        // Annualized rate of this specific hike (CAGR)
        hikeCagr = calculateAnnualizedGrowth(prevCtc, ctc, diffDays)

        // Cumulative CAGR from initial revision of this salary source
        const firstRev = sortedRevs[0]!
        const firstCtc = parseFloat(firstRev.annualCtc) || 0
        const totalDaysFromStart =
          (new Date(rev.effectiveDate).getTime() - new Date(firstRev.effectiveDate).getTime()) /
          (1000 * 60 * 60 * 24)
        cumulativeCagr = calculateAnnualizedGrowth(firstCtc, ctc, totalDaysFromStart)
      }

      return {
        ...rev,
        annualCtcNumber: ctc,
        baseSalaryNumber: base,
        monthlyInHandNumber: monthly,
        variablePayNumber: variable,
        stockGrantNumber: stock,
        calculatedHikePercentage,
        hikeAmount,
        monthsSinceLastRevision,
        hikeCagr,
        hikeXirr: hikeCagr,
        cumulativeCagr,
        cumulativeXirr: cumulativeCagr,
      }
    })

    // Active revision is the latest revision whose effective date is <= today
    const pastRevs = enrichedRevisions.filter((r) => new Date(r.effectiveDate) <= now)
    const currentRevision =
      pastRevs.length > 0
        ? pastRevs[pastRevs.length - 1]
        : enrichedRevisions[enrichedRevisions.length - 1] || null

    // Future revisions (scheduled mid-year hikes!)
    const upcomingRevisions = enrichedRevisions.filter((r) => new Date(r.effectiveDate) > now)

    return {
      ...source,
      revisions: enrichedRevisions,
      currentRevision,
      upcomingRevisions,
      currentAnnualCtc: currentRevision ? currentRevision.annualCtcNumber : 0,
      currentMonthlyInHand: currentRevision ? currentRevision.monthlyInHandNumber : 0,
      currentBaseSalary: currentRevision ? currentRevision.baseSalaryNumber : 0,
      currentVariablePay: currentRevision ? currentRevision.variablePayNumber : 0,
      currentStockGrant: currentRevision ? currentRevision.stockGrantNumber : 0,
      totalHikesCount: Math.max(0, enrichedRevisions.length - 1),
    }
  })

  // Calculate aggregated stats across all active sources
  const activeSources = enrichedSources.filter((s) => s.status === 'active')
  const totalActiveAnnualCtc = activeSources.reduce((sum, s) => sum + s.currentAnnualCtc, 0)
  const totalActiveMonthlyInHand = activeSources.reduce((sum, s) => sum + s.currentMonthlyInHand, 0)
  const totalActiveBaseSalary = activeSources.reduce((sum, s) => sum + s.currentBaseSalary, 0)
  const totalActiveVariablePay = activeSources.reduce((sum, s) => sum + s.currentVariablePay, 0)
  const totalActiveStockGrant = activeSources.reduce((sum, s) => sum + s.currentStockGrant, 0)

  // Find latest hike across all sources
  const allHikes = enrichedSources
    .flatMap((s) =>
      s.revisions
        .filter((r) => r.hikeAmount > 0)
        .map((r) => ({
          ...r,
          companyName: s.companyName,
          role: s.role,
        }))
    )
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())

  const latestHike = allHikes.length > 0 ? allHikes[0] : null

  // All revisions flattened for career baseline
  const allRevisionsFlattened = enrichedSources
    .flatMap((s) => s.revisions)
    .sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime())

  const earliestRev = allRevisionsFlattened.length > 0 ? allRevisionsFlattened[0]! : null
  const latestRev = allRevisionsFlattened.length > 0 ? allRevisionsFlattened[allRevisionsFlattened.length - 1]! : null
  const earliestSalary = earliestRev ? earliestRev.annualCtcNumber : null
  const currentTotalSalary = totalActiveAnnualCtc > 0 ? totalActiveAnnualCtc : (latestRev ? latestRev.annualCtcNumber : 0)
  const careerSalaryMultiplier =
    earliestSalary && earliestSalary > 0 && currentTotalSalary > 0
      ? currentTotalSalary / earliestSalary
      : null

  let careerCagr: number | null = null
  let finalHikeCagr: number | null = null

  if (earliestRev && earliestSalary && earliestSalary > 0 && currentTotalSalary > 0) {
    const careerStartDate = new Date(earliestRev.effectiveDate)
    const careerEndDate =
      totalActiveAnnualCtc > 0 && now > careerStartDate
        ? now
        : latestRev
        ? new Date(latestRev.effectiveDate)
        : now
    const totalCareerDays = (careerEndDate.getTime() - careerStartDate.getTime()) / (1000 * 60 * 60 * 24)
    careerCagr = calculateAnnualizedGrowth(earliestSalary, currentTotalSalary, totalCareerDays)
  }

  if (latestHike) {
    finalHikeCagr = latestHike.hikeCagr ?? latestHike.hikeXirr ?? null
  }

  return c.json({
    success: true,
    data: {
      sources: enrichedSources,
      summary: {
        totalActiveSources: activeSources.length,
        totalActiveAnnualCtc,
        totalActiveMonthlyInHand,
        totalActiveBaseSalary,
        totalActiveVariablePay,
        totalActiveStockGrant,
        totalHikesCount: allHikes.length,
        latestHike: latestHike
          ? {
              effectiveDate: latestHike.effectiveDate,
              hikePercentage: latestHike.calculatedHikePercentage,
              hikeAmount: latestHike.hikeAmount,
              hikeCagr: latestHike.hikeCagr,
              hikeXirr: latestHike.hikeCagr,
              cumulativeCagr: latestHike.cumulativeCagr,
              cumulativeXirr: latestHike.cumulativeCagr,
              companyName: latestHike.companyName,
              hikeType: latestHike.hikeType,
              designation: latestHike.designation,
            }
          : null,
        careerSalaryMultiplier,
        careerCagr,
        careerXirr: careerCagr,
        finalHikeCagr,
        finalHikeXirr: finalHikeCagr,
      },
    },
  })
})

// POST /v1/salary/sources - create a salary source
salaryRoute.post('/sources', zValidator('json', createSourceSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    const startDate = new Date(body.startDate)
    const endDate = body.endDate ? new Date(body.endDate) : null

    const [source] = await db
      .insert(salarySources)
      .values({
        userId,
        ownerId: body.ownerId ?? null,
        companyName: body.companyName,
        role: body.role,
        employmentType: body.employmentType,
        currency: body.currency,
        startDate,
        endDate,
        status: body.status,
        notes: body.notes ?? null,
      })
      .returning()

    // If initial CTC provided, automatically insert the starting revision
    if (body.initialAnnualCtc && body.initialAnnualCtc > 0) {
      const monthlyInHand = body.initialMonthlyInHand ?? Math.round(body.initialAnnualCtc / 12)
      await db.insert(salaryRevisions).values({
        salarySourceId: source!.id,
        userId,
        effectiveDate: startDate,
        annualCtc: body.initialAnnualCtc.toString(),
        baseSalary: body.initialBaseSalary ? body.initialBaseSalary.toString() : null,
        monthlyInHand: monthlyInHand.toString(),
        variablePay: body.initialVariablePay ? body.initialVariablePay.toString() : '0',
        stockGrant: body.initialStockGrant ? body.initialStockGrant.toString() : '0',
        hikePercentage: null,
        hikeType: 'joining',
        designation: body.role,
        notes: 'Initial joining compensation',
      })
    }

    const complete = await db.query.salarySources.findFirst({
      where: eq(salarySources.id, source!.id),
      with: {
        revisions: true,
        owner: true,
      },
    })

    return c.json({ success: true, data: complete }, 201)
  } catch (err: any) {
    console.error('Error creating salary source:', err)
    return c.json(
      { success: false, error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to create salary source' } },
      500
    )
  }
})

// PATCH /v1/salary/sources/:id - update a salary source
salaryRoute.patch('/sources/:id', zValidator('json', updateSourceSchema), async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')
  const body = c.req.valid('json')

  const existing = await db.query.salarySources.findFirst({
    where: and(eq(salarySources.id, sourceId), eq(salarySources.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Salary source not found' } }, 404)
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (body.companyName !== undefined) updateData['companyName'] = body.companyName
  if (body.role !== undefined) updateData['role'] = body.role
  if (body.employmentType !== undefined) updateData['employmentType'] = body.employmentType
  if (body.currency !== undefined) updateData['currency'] = body.currency
  if (body.startDate !== undefined) updateData['startDate'] = new Date(body.startDate)
  if (body.endDate !== undefined) updateData['endDate'] = body.endDate ? new Date(body.endDate) : null
  if (body.status !== undefined) updateData['status'] = body.status
  if (body.notes !== undefined) updateData['notes'] = body.notes
  if (body.ownerId !== undefined) updateData['ownerId'] = body.ownerId

  const [updated] = await db
    .update(salarySources)
    .set(updateData)
    .where(and(eq(salarySources.id, sourceId), eq(salarySources.userId, userId)))
    .returning()

  return c.json({ success: true, data: updated })
})

// DELETE /v1/salary/sources/:id - delete a salary source
salaryRoute.delete('/sources/:id', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')

  const existing = await db.query.salarySources.findFirst({
    where: and(eq(salarySources.id, sourceId), eq(salarySources.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Salary source not found' } }, 404)
  }

  await db.delete(salarySources).where(and(eq(salarySources.id, sourceId), eq(salarySources.userId, userId)))

  return c.json({ success: true, data: null })
})

/**
 * Date-wise recalculates hike percentages and sequences for all revisions of a salary source.
 * This guarantees that even if revisions were added out-of-order, or an effectiveDate was corrected,
 * every revision's hike percentage is strictly calculated against the chronologically prior revision.
 */
export async function recalculateSourceRevisionsDateWise(salarySourceId: string, userId: string) {
  const revs = await db.query.salaryRevisions.findMany({
    where: and(eq(salaryRevisions.salarySourceId, salarySourceId), eq(salaryRevisions.userId, userId)),
    orderBy: (rev, { asc }) => [asc(rev.effectiveDate)],
  })

  if (!revs || revs.length === 0) return []

  const updates: Array<{ id: string; hikePercentage: string | null }> = []

  for (let i = 0; i < revs.length; i++) {
    const rev = revs[i]!
    const ctc = parseFloat(rev.annualCtc) || 0

    let newHikePercentage: string | null = null
    if (i > 0) {
      const prevCtc = parseFloat(revs[i - 1]!.annualCtc) || 0
      if (prevCtc > 0) {
        newHikePercentage = (((ctc - prevCtc) / prevCtc) * 100).toFixed(2)
      }
    } else {
      // First chronological revision is the joining / baseline salary
      newHikePercentage = null
    }

    if (rev.hikePercentage !== newHikePercentage) {
      updates.push({ id: rev.id, hikePercentage: newHikePercentage })
      await db
        .update(salaryRevisions)
        .set({
          hikePercentage: newHikePercentage,
          updatedAt: new Date(),
        })
        .where(eq(salaryRevisions.id, rev.id))
    }
  }

  // Update role on salary source to match latest revision's designation if provided
  const latestRev = revs[revs.length - 1]
  if (latestRev && latestRev.designation) {
    await db
      .update(salarySources)
      .set({ role: latestRev.designation, updatedAt: new Date() })
      .where(eq(salarySources.id, salarySourceId))
  }

  return updates
}

// POST /v1/salary/recalculate - recalculate all salary revisions date-wise across all sources
salaryRoute.post('/recalculate', async (c) => {
  const userId = c.get('userId')
  const sources = await db.query.salarySources.findMany({
    where: eq(salarySources.userId, userId),
  })

  let totalUpdated = 0
  for (const src of sources) {
    const updates = await recalculateSourceRevisionsDateWise(src.id, userId)
    totalUpdated += updates.length
  }

  return c.json({
    success: true,
    data: {
      message: `Date-wise recalculation completed. Updated ${totalUpdated} revision(s).`,
      sourcesProcessed: sources.length,
      totalUpdated,
    },
  })
})

// POST /v1/salary/revisions - record a salary revision / hike (supports mid-year hikes with effective date)
salaryRoute.post('/revisions', zValidator('json', createRevisionSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    // Verify source belongs to user
    const source = await db.query.salarySources.findFirst({
      where: and(eq(salarySources.id, body.salarySourceId), eq(salarySources.userId, userId)),
    })

    if (!source) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Salary source not found' } }, 404)
    }

    const effectiveDate = new Date(body.effectiveDate)
    const monthlyInHand = body.monthlyInHand ?? Math.round(body.annualCtc / 12)

    const [revision] = await db
      .insert(salaryRevisions)
      .values({
        salarySourceId: body.salarySourceId,
        userId,
        effectiveDate,
        annualCtc: body.annualCtc.toString(),
        baseSalary: body.baseSalary ? body.baseSalary.toString() : null,
        monthlyInHand: monthlyInHand.toString(),
        variablePay: body.variablePay ? body.variablePay.toString() : '0',
        stockGrant: body.stockGrant ? body.stockGrant.toString() : '0',
        hikePercentage: body.hikePercentage !== undefined && body.hikePercentage !== null ? body.hikePercentage.toString() : null,
        hikeType: body.hikeType,
        designation: body.designation ?? null,
        notes: body.notes ?? null,
      })
      .returning()

    // Trigger date-wise recalculation for all revisions in this salary source
    await recalculateSourceRevisionsDateWise(body.salarySourceId, userId)

    const updatedRevision = await db.query.salaryRevisions.findFirst({
      where: eq(salaryRevisions.id, revision!.id),
    })

    return c.json({ success: true, data: updatedRevision }, 201)
  } catch (err: any) {
    console.error('Error recording salary revision:', err)
    return c.json(
      { success: false, error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to record hike revision' } },
      500
    )
  }
})

// PATCH /v1/salary/revisions/:id - update a salary revision
salaryRoute.patch('/revisions/:id', zValidator('json', updateRevisionSchema), async (c) => {
  const userId = c.get('userId')
  const revisionId = c.req.param('id')
  const body = c.req.valid('json')

  const existing = await db.query.salaryRevisions.findFirst({
    where: and(eq(salaryRevisions.id, revisionId), eq(salaryRevisions.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Salary revision not found' } }, 404)
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (body.effectiveDate !== undefined) updateData['effectiveDate'] = new Date(body.effectiveDate)
  if (body.annualCtc !== undefined) updateData['annualCtc'] = body.annualCtc.toString()
  if (body.baseSalary !== undefined) updateData['baseSalary'] = body.baseSalary.toString()
  if (body.monthlyInHand !== undefined) updateData['monthlyInHand'] = body.monthlyInHand.toString()
  if (body.variablePay !== undefined) updateData['variablePay'] = body.variablePay.toString()
  if (body.stockGrant !== undefined) updateData['stockGrant'] = body.stockGrant.toString()
  if (body.hikePercentage !== undefined) updateData['hikePercentage'] = body.hikePercentage.toString()
  if (body.hikeType !== undefined) updateData['hikeType'] = body.hikeType
  if (body.designation !== undefined) updateData['designation'] = body.designation
  if (body.notes !== undefined) updateData['notes'] = body.notes

  await db
    .update(salaryRevisions)
    .set(updateData)
    .where(and(eq(salaryRevisions.id, revisionId), eq(salaryRevisions.userId, userId)))

  // Always re-chain all revisions date-wise
  await recalculateSourceRevisionsDateWise(existing.salarySourceId, userId)

  const reloaded = await db.query.salaryRevisions.findFirst({
    where: eq(salaryRevisions.id, revisionId),
  })

  return c.json({ success: true, data: reloaded })
})

// DELETE /v1/salary/revisions/:id - delete a revision
salaryRoute.delete('/revisions/:id', async (c) => {
  const userId = c.get('userId')
  const revisionId = c.req.param('id')

  const existing = await db.query.salaryRevisions.findFirst({
    where: and(eq(salaryRevisions.id, revisionId), eq(salaryRevisions.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Salary revision not found' } }, 404)
  }

  await db
    .delete(salaryRevisions)
    .where(and(eq(salaryRevisions.id, revisionId), eq(salaryRevisions.userId, userId)))

  // Re-chain remaining revisions date-wise
  await recalculateSourceRevisionsDateWise(existing.salarySourceId, userId)

  return c.json({ success: true, data: null })
})

// GET /v1/salary/timeline - comprehensive compensation timeline across career
salaryRoute.get('/timeline', async (c) => {
  const userId = c.get('userId')
  const ownerIdParam = c.req.query('ownerId')

  const conditions = [eq(salarySources.userId, userId)]
  if (ownerIdParam && ownerIdParam !== 'all') {
    conditions.push(eq(salarySources.ownerId, ownerIdParam))
  }

  const sources = await db.query.salarySources.findMany({
    where: and(...conditions),
    with: {
      owner: true,
      revisions: true,
    },
  })

  // Collect all revisions annotated with source details
  const timelineEvents: Array<{
    revisionId: string
    sourceId: string
    companyName: string
    role: string
    ownerName?: string | undefined
    ownerColor?: string | undefined
    effectiveDate: string
    annualCtc: number
    baseSalary: number
    monthlyInHand: number
    variablePay: number
    stockGrant: number
    hikePercentage: number | null
    hikeType: string
    hikeCagr?: number | null
    hikeXirr?: number | null
    designation?: string | undefined
    notes?: string | undefined
  }> = []

  for (const source of sources) {
    const sourceRevs = [...(source.revisions || [])].sort(
      (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
    )

    sourceRevs.forEach((rev, idx) => {
      let hikePercentage: number | null = null
      let hikeCagr: number | null = null
      if (idx > 0) {
        const prevRev = sourceRevs[idx - 1]!
        const prevCtc = parseFloat(prevRev.annualCtc) || 0
        const ctc = parseFloat(rev.annualCtc) || 0
        if (prevCtc > 0) {
          hikePercentage = parseFloat((((ctc - prevCtc) / prevCtc) * 100).toFixed(1))
        }
        const diffDays =
          (new Date(rev.effectiveDate).getTime() - new Date(prevRev.effectiveDate).getTime()) /
          (1000 * 60 * 60 * 24)
        hikeCagr = calculateAnnualizedGrowth(prevCtc, ctc, diffDays)
      }

      timelineEvents.push({
        revisionId: rev.id,
        sourceId: source.id,
        companyName: source.companyName,
        role: source.role,
        ownerName: source.owner?.name,
        ownerColor: source.owner?.color,
        effectiveDate: rev.effectiveDate.toISOString().split('T')[0]!,
        annualCtc: parseFloat(rev.annualCtc) || 0,
        baseSalary: parseFloat(rev.baseSalary || '0') || 0,
        monthlyInHand: parseFloat(rev.monthlyInHand || '0') || 0,
        variablePay: parseFloat(rev.variablePay || '0') || 0,
        stockGrant: parseFloat(rev.stockGrant || '0') || 0,
        hikePercentage,
        hikeType: rev.hikeType,
        hikeCagr,
        hikeXirr: hikeCagr,
        designation: rev.designation || undefined,
        notes: rev.notes || undefined,
      })
    })
  }

  // Sort chronologically
  timelineEvents.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime())

  // Calculate cumulative growth and CAGRs from career starting revision
  const startCtc = timelineEvents.length > 0 ? timelineEvents[0]!.annualCtc : 0
  const startDate = timelineEvents.length > 0 ? new Date(timelineEvents[0]!.effectiveDate).getTime() : 0

  const enrichedTimeline = timelineEvents.map((event, idx) => {
    const cumulativeGrowth = startCtc > 0 ? ((event.annualCtc - startCtc) / startCtc) * 100 : 0

    let cumulativeCagr: number | null = null
    const isFinalHike = idx === timelineEvents.length - 1 && timelineEvents.length > 1

    if (idx > 0) {
      const totalDays = (new Date(event.effectiveDate).getTime() - startDate) / (1000 * 60 * 60 * 24)
      cumulativeCagr = calculateAnnualizedGrowth(startCtc, event.annualCtc, totalDays)
    }

    return {
      ...event,
      cumulativeGrowth: parseFloat(cumulativeGrowth.toFixed(1)),
      cumulativeCagr,
      cumulativeXirr: cumulativeCagr,
      isFinalHike,
    }
  })

  return c.json({
    success: true,
    data: enrichedTimeline,
  })
})

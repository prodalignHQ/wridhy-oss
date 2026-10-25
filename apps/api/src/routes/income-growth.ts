import { Hono } from 'hono'
import { db } from '@momoney/db'
import { financialYearIncomes, owners, salarySources, salaryRevisions } from '@momoney/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc, asc, isNull } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const incomeGrowthRoute = new Hono<{
  Variables: {
    userId: string
  }
}>()

incomeGrowthRoute.use('*', authMiddleware)

// Helper to extract start year from "2024-25", "FY 2024-25", "2024", etc.
export function parseFYStartYear(fy: string): number {
  const match = fy.match(/(\d{4})/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return 0
}

// Normalize financial year string to "FY YYYY-YY"
export function normalizeFY(fy: string): string {
  const clean = fy.trim().toUpperCase()
  const match = clean.match(/(?:FY\s*)?(\d{4})[-/](\d{2,4})/)
  if (match && match[1] && match[2]) {
    const startYear = parseInt(match[1], 10)
    let endYearSuffix = match[2]
    if (endYearSuffix.length === 4) {
      endYearSuffix = endYearSuffix.slice(2)
    }
    return `FY ${startYear}-${endYearSuffix}`
  }
  if (!clean.startsWith('FY ') && clean.match(/^\d{4}/)) {
    return `FY ${clean}`
  }
  return clean
}

const createIncomeSchema = z.object({
  ownerId: z.string().uuid().nullable().optional(),
  financialYear: z.string().min(1, 'Financial Year is required'),
  grossIncome: z.number().nonnegative('Gross income must be non-negative'),
  taxPaid: z.number().nonnegative('Tax paid must be non-negative').default(0),
  netIncome: z.number().nonnegative('Net income must be non-negative').optional(),
  breakdown: z
    .object({
      salary: z.number().nonnegative().optional(),
      bonus: z.number().nonnegative().optional(),
      business: z.number().nonnegative().optional(),
      investments: z.number().nonnegative().optional(),
      rental: z.number().nonnegative().optional(),
      freelance: z.number().nonnegative().optional(),
      other: z.number().nonnegative().optional(),
    })
    .optional(),
  notes: z.string().nullable().optional(),
  mode: z.enum(['create', 'add', 'overwrite']).optional().default('create'),
})

const updateIncomeSchema = createIncomeSchema.partial()

incomeGrowthRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const ownerIdParam = c.req.query('ownerId')

  const conditions = [eq(financialYearIncomes.userId, userId)]
  if (ownerIdParam && ownerIdParam !== 'all') {
    conditions.push(eq(financialYearIncomes.ownerId, ownerIdParam))
  }

  const records = await db.query.financialYearIncomes.findMany({
    where: and(...conditions),
    with: {
      owner: true,
    },
  })

  // Sort chronologically by start year
  const sorted = [...records].sort((a, b) => {
    const yearA = parseFYStartYear(a.financialYear)
    const yearB = parseFYStartYear(b.financialYear)
    return yearA - yearB
  })

  // Calculate year-over-year metrics
  const enriched = sorted.map((record, index) => {
    const currentGross = parseFloat(record.grossIncome) || 0
    const currentNet = parseFloat(record.netIncome) || 0
    const currentTax = parseFloat(record.taxPaid) || 0

    let yoyGrowthAmount = 0
    let yoyGrowthPercentage: number | null = null
    let yoyNetGrowthPercentage: number | null = null

    if (index > 0) {
      const prevGross = parseFloat(sorted[index - 1]!.grossIncome) || 0
      const prevNet = parseFloat(sorted[index - 1]!.netIncome) || 0

      yoyGrowthAmount = currentGross - prevGross
      if (prevGross > 0) {
        yoyGrowthPercentage = ((currentGross - prevGross) / prevGross) * 100
      }
      if (prevNet > 0) {
        yoyNetGrowthPercentage = ((currentNet - prevNet) / prevNet) * 100
      }
    }

    const effectiveTaxRate = currentGross > 0 ? (currentTax / currentGross) * 100 : 0

    return {
      ...record,
      grossIncomeNumber: currentGross,
      netIncomeNumber: currentNet,
      taxPaidNumber: currentTax,
      effectiveTaxRate,
      yoyGrowthAmount,
      yoyGrowthPercentage,
      yoyNetGrowthPercentage,
    }
  })

  // Calculate summary stats
  let cagr: number | null = null
  let totalGross = 0
  let totalNet = 0
  let totalTax = 0

  if (enriched.length > 0) {
    totalGross = enriched.reduce((sum, item) => sum + item.grossIncomeNumber, 0)
    totalNet = enriched.reduce((sum, item) => sum + item.netIncomeNumber, 0)
    totalTax = enriched.reduce((sum, item) => sum + item.taxPaidNumber, 0)

    if (enriched.length > 1) {
      const first = enriched[0]!
      const last = enriched[enriched.length - 1]!
      const yearsDiff = enriched.length - 1
      if (first.grossIncomeNumber > 0 && last.grossIncomeNumber > 0 && yearsDiff > 0) {
        cagr = (Math.pow(last.grossIncomeNumber / first.grossIncomeNumber, 1 / yearsDiff) - 1) * 100
      }
    }
  }

  const latest = enriched.length > 0 ? enriched[enriched.length - 1] : null
  const earliest = enriched.length > 0 ? enriched[0] : null
  const overallMultiplier =
    earliest && earliest.grossIncomeNumber > 0 && latest
      ? latest.grossIncomeNumber / earliest.grossIncomeNumber
      : null

  return c.json({
    success: true,
    data: {
      records: enriched,
      summary: {
        totalRecords: enriched.length,
        latestGrossIncome: latest?.grossIncomeNumber ?? 0,
        latestNetIncome: latest?.netIncomeNumber ?? 0,
        latestTaxPaid: latest?.taxPaidNumber ?? 0,
        latestYoYGrowth: latest?.yoyGrowthPercentage ?? null,
        averageAnnualGross: enriched.length > 0 ? totalGross / enriched.length : 0,
        cagr,
        overallMultiplier,
        totalCumulativeGross: totalGross,
        totalCumulativeTax: totalTax,
        totalCumulativeNet: totalNet,
      },
    },
  })
})

incomeGrowthRoute.post('/', zValidator('json', createIncomeSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    const normalizedFYName = normalizeFY(body.financialYear)
    const netIncome = body.netIncome !== undefined ? body.netIncome : Math.max(0, body.grossIncome - body.taxPaid)

    // Check if a record already exists for this financial year & owner
    const ownerCondition = body.ownerId
      ? eq(financialYearIncomes.ownerId, body.ownerId)
      : isNull(financialYearIncomes.ownerId)

    const existing = await db.query.financialYearIncomes.findFirst({
      where: and(
        eq(financialYearIncomes.userId, userId),
        eq(financialYearIncomes.financialYear, normalizedFYName),
        ownerCondition
      ),
      with: {
        owner: true,
      },
    })

    if (existing) {
      if (body.mode === 'add') {
        const existingGross = parseFloat(existing.grossIncome) || 0
        const existingTax = parseFloat(existing.taxPaid) || 0
        const existingNet = parseFloat(existing.netIncome) || 0

        const newGross = existingGross + body.grossIncome
        const newTax = existingTax + body.taxPaid
        const newNet = existingNet + (body.netIncome !== undefined ? body.netIncome : Math.max(0, body.grossIncome - body.taxPaid))

        // Merge breakdown
        const existingBd = (existing.breakdown as Record<string, number>) || {}
        const incomingBd = (body.breakdown as Record<string, number>) || {}
        const mergedBd: Record<string, number> = { ...existingBd }
        for (const [k, v] of Object.entries(incomingBd)) {
          if (typeof v === 'number' && v > 0) {
            mergedBd[k] = (mergedBd[k] || 0) + v
          }
        }

        // Merge notes
        let mergedNotes = existing.notes
        if (body.notes && body.notes.trim()) {
          mergedNotes = existing.notes
            ? `${existing.notes}\n${body.notes.trim()}`
            : body.notes.trim()
        }

        const [updated] = await db
          .update(financialYearIncomes)
          .set({
            grossIncome: newGross.toString(),
            taxPaid: newTax.toString(),
            netIncome: newNet.toString(),
            breakdown: mergedBd as any,
            notes: mergedNotes,
            updatedAt: new Date(),
          })
          .where(eq(financialYearIncomes.id, existing.id))
          .returning()

        return c.json({ success: true, data: updated, action: 'added' }, 200)
      } else if (body.mode === 'overwrite') {
        const [updated] = await db
          .update(financialYearIncomes)
          .set({
            grossIncome: body.grossIncome.toString(),
            taxPaid: body.taxPaid.toString(),
            netIncome: netIncome.toString(),
            breakdown: (body.breakdown ?? {}) as any,
            notes: body.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(financialYearIncomes.id, existing.id))
          .returning()

        return c.json({ success: true, data: updated, action: 'overwritten' }, 200)
      } else {
        // mode is 'create', but record already exists
        return c.json(
          {
            success: false,
            error: {
              code: 'FY_ALREADY_EXISTS',
              message: `Income data for ${normalizedFYName} already exists.`,
            },
            existingRecord: {
              id: existing.id,
              financialYear: existing.financialYear,
              ownerId: existing.ownerId,
              grossIncome: parseFloat(existing.grossIncome) || 0,
              taxPaid: parseFloat(existing.taxPaid) || 0,
              netIncome: parseFloat(existing.netIncome) || 0,
              breakdown: existing.breakdown || {},
              notes: existing.notes,
              ownerName: existing.owner?.name || null,
            },
          },
          409
        )
      }
    }

    const [record] = await db
      .insert(financialYearIncomes)
      .values({
        userId,
        ownerId: body.ownerId ?? null,
        financialYear: normalizedFYName,
        grossIncome: body.grossIncome.toString(),
        taxPaid: body.taxPaid.toString(),
        netIncome: netIncome.toString(),
        breakdown: (body.breakdown ?? {}) as any,
        notes: body.notes ?? null,
      })
      .returning()

    return c.json({ success: true, data: record, action: 'created' }, 201)
  } catch (err: any) {
    console.error('Error creating financial year income:', err)
    return c.json(
      { success: false, error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to create record' } },
      500
    )
  }
})

incomeGrowthRoute.patch('/:id', zValidator('json', updateIncomeSchema), async (c) => {
  const userId = c.get('userId')
  const recordId = c.req.param('id')
  const body = c.req.valid('json')

  const existing = await db.query.financialYearIncomes.findFirst({
    where: and(eq(financialYearIncomes.id, recordId), eq(financialYearIncomes.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Income record not found' } }, 404)
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  }

  if (body.financialYear !== undefined) {
    updateData['financialYear'] = normalizeFY(body.financialYear)
  }
  if (body.ownerId !== undefined) {
    updateData['ownerId'] = body.ownerId
  }
  if (body.grossIncome !== undefined) {
    updateData['grossIncome'] = body.grossIncome.toString()
  }
  if (body.taxPaid !== undefined) {
    updateData['taxPaid'] = body.taxPaid.toString()
  }
  if (body.netIncome !== undefined) {
    updateData['netIncome'] = body.netIncome.toString()
  } else if (body.grossIncome !== undefined || body.taxPaid !== undefined) {
    const gross = body.grossIncome !== undefined ? body.grossIncome : parseFloat(existing.grossIncome)
    const tax = body.taxPaid !== undefined ? body.taxPaid : parseFloat(existing.taxPaid)
    updateData['netIncome'] = Math.max(0, gross - tax).toString()
  }
  if (body.breakdown !== undefined) {
    updateData['breakdown'] = body.breakdown
  }
  if (body.notes !== undefined) {
    updateData['notes'] = body.notes
  }

  const [updated] = await db
    .update(financialYearIncomes)
    .set(updateData)
    .where(and(eq(financialYearIncomes.id, recordId), eq(financialYearIncomes.userId, userId)))
    .returning()

  return c.json({ success: true, data: updated })
})

incomeGrowthRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const recordId = c.req.param('id')

  const existing = await db.query.financialYearIncomes.findFirst({
    where: and(eq(financialYearIncomes.id, recordId), eq(financialYearIncomes.userId, userId)),
  })

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Income record not found' } }, 404)
  }

  await db
    .delete(financialYearIncomes)
    .where(and(eq(financialYearIncomes.id, recordId), eq(financialYearIncomes.userId, userId)))

  return c.json({ success: true, data: null })
})

// Endpoint to calculate earned salary from Salary Progress for any Financial Year (e.g., handles mid-year hikes!)
incomeGrowthRoute.post(
  '/calculate-from-salary',
  zValidator(
    'json',
    z.object({
      financialYear: z.string().min(1),
      ownerId: z.string().uuid().optional().nullable(),
    })
  ),
  async (c) => {
    const userId = c.get('userId')
    const { financialYear, ownerId } = c.req.valid('json')

    const startYear = parseFYStartYear(financialYear)
    if (!startYear) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Could not determine financial year start year' } },
        400
      )
    }

    // Indian Financial Year: April 1 to March 31
    const fyStart = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)) // Month 3 = April (0-indexed)
    const fyEnd = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)) // Month 2 = March

    // Fetch salary sources for user
    const sources = await db.query.salarySources.findMany({
      where: and(
        eq(salarySources.userId, userId),
        ownerId ? eq(salarySources.ownerId, ownerId) : undefined
      ),
      with: {
        revisions: {
          orderBy: (rev, { asc }) => [asc(rev.effectiveDate)],
        },
      },
    })

    let totalEarnedSalary = 0
    let totalEstimatedInHand = 0
    const sourceBreakdowns: Array<{
      sourceId: string
      companyName: string
      role: string
      earnedInFY: number
      periods: Array<{
        startDate: string
        endDate: string
        days: number
        annualCtc: number
        monthlyInHand: number
        effectiveRateEarned: number
        hikeType?: string | undefined
        designation?: string | undefined
      }>
    }> = []

    for (const source of sources) {
      if (!source.revisions || source.revisions.length === 0) continue

      // Check if this source overlaps with the FY
      const employmentStart = new Date(source.startDate)
      const employmentEnd = source.endDate ? new Date(source.endDate) : fyEnd

      if (employmentStart > fyEnd || employmentEnd < fyStart) {
        continue
      }

      const activeStart = employmentStart > fyStart ? employmentStart : fyStart
      const activeEnd = employmentEnd < fyEnd ? employmentEnd : fyEnd

      // Now determine salary revisions active during each sub-period of [activeStart, activeEnd]
      const revs = [...source.revisions].sort(
        (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
      )

      let sourceEarned = 0
      const periods: Array<{
        startDate: string
        endDate: string
        days: number
        annualCtc: number
        monthlyInHand: number
        effectiveRateEarned: number
        hikeType?: string | undefined
        designation?: string | undefined
      }> = []

      for (let i = 0; i < revs.length; i++) {
        const rev = revs[i]!
        const revStart = new Date(rev.effectiveDate)
        const nextRev = revs[i + 1]
        const revEnd = nextRev ? new Date(nextRev.effectiveDate.getTime() - 86400000) : activeEnd

        // Period overlap with [activeStart, activeEnd]
        const periodStart = revStart > activeStart ? revStart : activeStart
        const periodEnd = revEnd < activeEnd ? revEnd : activeEnd

        if (periodStart <= periodEnd) {
          const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const annualCtc = parseFloat(rev.annualCtc) || 0
          const monthlyInHand = parseFloat(rev.monthlyInHand || '0') || annualCtc / 12
          const earned = Math.round((annualCtc / 365) * days)

          sourceEarned += earned
          totalEstimatedInHand += Math.round(((monthlyInHand * 12) / 365) * days)

          periods.push({
            startDate: periodStart.toISOString().split('T')[0]!,
            endDate: periodEnd.toISOString().split('T')[0]!,
            days,
            annualCtc,
            monthlyInHand,
            effectiveRateEarned: earned,
            hikeType: rev.hikeType,
            designation: rev.designation || undefined,
          })
        }
      }

      totalEarnedSalary += sourceEarned
      sourceBreakdowns.push({
        sourceId: source.id,
        companyName: source.companyName,
        role: source.role,
        earnedInFY: sourceEarned,
        periods,
      })
    }

    // Check if an income record already exists for this FY & owner
    const normalizedFY = normalizeFY(financialYear)
    const existingConditions = [
      eq(financialYearIncomes.userId, userId),
      eq(financialYearIncomes.financialYear, normalizedFY),
    ]
    if (ownerId) {
      existingConditions.push(eq(financialYearIncomes.ownerId, ownerId))
    } else {
      existingConditions.push(isNull(financialYearIncomes.ownerId))
    }

    let existingRecord = await db.query.financialYearIncomes.findFirst({
      where: and(...existingConditions),
      with: {
        owner: true,
      },
    })

    // If no exact ownerId match was found and ownerId wasn't passed, check any record for this FY
    if (!existingRecord && !ownerId) {
      existingRecord = await db.query.financialYearIncomes.findFirst({
        where: and(
          eq(financialYearIncomes.userId, userId),
          eq(financialYearIncomes.financialYear, normalizedFY)
        ),
        with: {
          owner: true,
        },
      })
    }

    return c.json({
      success: true,
      data: {
        financialYear: normalizedFY,
        fyStart: fyStart.toISOString().split('T')[0],
        fyEnd: fyEnd.toISOString().split('T')[0],
        totalEarnedSalary,
        totalEstimatedInHand,
        sourceBreakdowns,
        existingIncomeRecord: existingRecord
          ? {
              id: existingRecord.id,
              financialYear: existingRecord.financialYear,
              ownerId: existingRecord.ownerId,
              grossIncome: parseFloat(existingRecord.grossIncome) || 0,
              taxPaid: parseFloat(existingRecord.taxPaid) || 0,
              netIncome: parseFloat(existingRecord.netIncome) || 0,
              breakdown: existingRecord.breakdown || {},
              notes: existingRecord.notes,
              ownerName: existingRecord.owner?.name || null,
            }
          : null,
      },
    })
  }
)

// Direct endpoint to check if an FY already exists
incomeGrowthRoute.get('/check-fy', async (c) => {
  const userId = c.get('userId')
  const fy = c.req.query('financialYear')
  const ownerId = c.req.query('ownerId')
  if (!fy) return c.json({ success: true, data: null })

  const normalizedFY = normalizeFY(fy)
  const conditions = [
    eq(financialYearIncomes.userId, userId),
    eq(financialYearIncomes.financialYear, normalizedFY),
  ]
  if (ownerId && ownerId !== 'all' && ownerId !== 'none') {
    conditions.push(eq(financialYearIncomes.ownerId, ownerId))
  } else if (ownerId === 'none') {
    conditions.push(isNull(financialYearIncomes.ownerId))
  }

  const existing = await db.query.financialYearIncomes.findFirst({
    where: and(...conditions),
    with: {
      owner: true,
    },
  })

  return c.json({
    success: true,
    data: existing
      ? {
          id: existing.id,
          financialYear: existing.financialYear,
          ownerId: existing.ownerId,
          grossIncome: parseFloat(existing.grossIncome) || 0,
          taxPaid: parseFloat(existing.taxPaid) || 0,
          netIncome: parseFloat(existing.netIncome) || 0,
          breakdown: existing.breakdown || {},
          notes: existing.notes,
          ownerName: existing.owner?.name || null,
        }
      : null,
  })
})

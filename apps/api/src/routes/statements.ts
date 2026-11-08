import { Hono } from 'hono'
import { db } from '@momoney/db'
import { statements, transactions, financialAccounts, categories, categorizationRules, merchants } from '@momoney/db'
import { eq, and, desc, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createHash } from 'crypto'
import { getParser, listParsers } from '@momoney/parsers'
import { categorize, getDefaultMerchants } from '@momoney/rules-engine'
import { authMiddleware } from '../middleware/auth.js'

export const statementsRoute = new Hono<{
  Variables: { userId: string }
}>()

statementsRoute.use('*', authMiddleware)

// Helper: compute a stable dedup hash per transaction
function computeDedupHash(
  accountId: string,
  date: Date,
  amount: number,
  description: string,
  type?: 'debit' | 'credit'
): string {
  const signedAmount = type === 'credit' ? -Math.abs(amount) : Math.abs(amount)
  const key = `${accountId}|${date.toISOString()}|${signedAmount.toFixed(2)}|${description.slice(0, 50)}`
  return createHash('sha256').update(key).digest('hex')
}

// ─── GET /v1/statements ───────────────────────────────────────────────────────

const listQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
})

statementsRoute.get('/', zValidator('query', listQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { accountId } = c.req.valid('query')

  const conditions = [eq(statements.userId, userId)]
  if (accountId) conditions.push(eq(statements.accountId, accountId))

  const data = await db.query.statements.findMany({
    where: and(...conditions),
    orderBy: [desc(statements.importedAt)],
    with: {
      account: {
        columns: { accountName: true, accountType: true, bankName: true },
      },
    },
  })

  return c.json({ success: true, data })
})

// ─── POST /v1/statements/preview ──────────────────────────────────────────────

statementsRoute.post('/preview', async (c) => {
  // Parse multipart form body
  const body = await c.req.parseBody()
  const file = body['file']
  const bankId = String(body['bankId'] ?? '').trim()

  if (!file || typeof file === 'string') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing file in form data' } },
      400
    )
  }
  if (!bankId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing bankId' } },
      400
    )
  }

  // Get the parser
  const parser = getParser(bankId)
  if (!parser) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `No parser found for bankId "${bankId}".`,
        },
      },
      400
    )
  }

  // Parse the file buffer
  let buffer: ArrayBuffer
  try {
    buffer = await (file as File).arrayBuffer()
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Failed to read uploaded file' } },
      400
    )
  }

  try {
    const parsedTxns = await parser.parse(buffer)
    if (parsedTxns.length === 0) {
      console.warn(
        `[Statements] Preview failed: parser "${bankId}" returned 0 transactions for file "${(file as File).name}" (${buffer.byteLength} bytes).`
      )
      return c.json(
        {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'No transactions found. The file could not be parsed for this account type.',
          },
        },
        422
      )
    }
    return c.json({
      success: true,
      data: parsedTxns.map((t) => ({
        date: t.date.toISOString(),
        description: t.description,
        amount: Math.abs(t.amount),
        type: t.type,
      })),
    })
  } catch (err) {
    console.error('Preview parse error:', err)
    return c.json(
      {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Failed to parse statement file for preview.' },
      },
      422
    )
  }
})

// ─── POST /v1/statements/upload ───────────────────────────────────────────────

statementsRoute.post('/upload', async (c) => {
  const userId = c.get('userId')

  // Parse multipart form body
  const body = await c.req.parseBody()
  const file = body['file']
  const bankId = String(body['bankId'] ?? '').trim()
  const accountId = String(body['accountId'] ?? '').trim()
  const providedStatementMonth = String(body['statementMonth'] ?? '').trim()

  if (!file || typeof file === 'string') {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing file in form data' } },
      400
    )
  }
  if (!bankId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing bankId' } },
      400
    )
  }
  if (!accountId) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing accountId' } },
      400
    )
  }

  // Verify account belongs to this user
  const account = await db.query.financialAccounts.findFirst({
    where: and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)),
  })
  if (!account) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } },
      404
    )
  }

  // Get the parser
  const parser = getParser(bankId)
  if (!parser) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `No parser found for bankId "${bankId}". Supported: ${listParsers().map((p) => p.bankId).join(', ')}`,
        },
      },
      400
    )
  }

  // Parse the file buffer
  let buffer: ArrayBuffer
  try {
    buffer = await (file as File).arrayBuffer()
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Failed to read uploaded file' } },
      400
    )
  }

  let parsedTxns
  try {
    parsedTxns = await parser.parse(buffer)
  } catch (err) {
    console.error('Parse error:', err)
    return c.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse statement file. Check the file format.' } },
      422
    )
  }

  const parsedCount = parsedTxns.length

  if (parsedCount === 0) {
    console.warn(
      `[Statements] Upload failed: parser "${bankId}" returned 0 transactions for file "${(file as File).name}" (${buffer.byteLength} bytes).`
    )
    return c.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'No transactions found in the uploaded file.' } },
      422
    )
  }


  // Fetch categories for categorization
  const allCategories = await db.query.categories.findMany({
    where: or(eq(categories.userId, userId), isNull(categories.userId)),
  })

  // Fetch rules for categorization
  const allRules = await db.query.categorizationRules.findMany({
    where: or(eq(categorizationRules.userId, userId), isNull(categorizationRules.userId)),
    orderBy: (table, { asc, desc }) => [desc(table.source), asc(table.priority)],
  })

  // Fetch user merchants (system merchants are built into the rules-engine)
  const userMerchants = await db.query.merchants.findMany({
    where: and(eq(merchants.userId, userId), eq(merchants.isSystem, false)),
  })

  // Convert DB categories to rules-engine format
  const categoryMap = new Map(allCategories.map((cat) => [cat.id, { id: cat.id, name: cat.name, color: cat.color }]))

  // Compute dedup hashes for all parsed transactions
  const withHashes = parsedTxns.map((txn) => ({
    ...txn,
    amount: Math.abs(txn.amount),
    dedupHash: computeDedupHash(accountId, txn.date, txn.amount, txn.description, txn.type),
  }))

  // Derive statementMonth from user input or from earliest transaction date
  let statementMonth: string
  if (providedStatementMonth) {
    statementMonth = providedStatementMonth // Already in YYYY-MM-DD format from frontend
  } else {
    const sortedByDate = [...withHashes].sort((a, b) => a.date.getTime() - b.date.getTime())
    const earliestDate = sortedByDate[0]?.date
    statementMonth = earliestDate
      ? `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}-01`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  }

  // Import within a DB transaction
  let importedCount = 0
  let duplicatesSkipped = 0
  let statementId: string

  await db.transaction(async (tx) => {
    // Create the statement record first
    const [stmt] = await tx
      .insert(statements)
      .values({
        userId,
        accountId,
        bankId,
        statementMonth,
        parsedCount,
        importedCount: 0, // will update
        duplicatesSkipped: 0,
      })
      .returning()

    statementId = stmt!.id

    // Insert transactions one by one (checking dedup)
    for (const txnData of withHashes) {
      // Try inserting — skip on unique constraint violation (dedup)
      try {
        // Auto-categorize the transaction
        const categorizationResult = categorize(
          {
            date: txnData.date,
            description: txnData.description,
            amount: txnData.amount,
            type: txnData.type,
          },
          allRules.map((r) => ({
            id: r.id,
            userId: r.userId,
            matchField: r.matchField,
            matchType: r.matchType,
            matchValue: r.matchValue,
            categoryId: r.categoryId,
            priority: r.priority,
            source: r.source,
            isActive: r.isActive,
          })),
          Array.from(categoryMap.values()),
          userMerchants.map((m) => ({
            id: m.id,
            userId: m.userId,
            rawPatterns: m.rawPatterns,
            normalizedName: m.normalizedName,
            defaultCategoryId: m.defaultCategoryId,
            isSystem: m.isSystem,
          })),
          getDefaultMerchants()
        )

        const [inserted] = await tx
          .insert(transactions)
          .values({
            userId,
            accountId,
            statementId: stmt!.id,
            date: txnData.date,
            description: txnData.description,
            merchant: null,
            amount: Math.abs(txnData.amount).toFixed(2),
            type: txnData.type,
            categoryId: categorizationResult.categoryId || null,
            dedupHash: txnData.dedupHash,
          })
          .onConflictDoNothing({ target: transactions.dedupHash })
          .returning()

        if (inserted) {
          // No auto-assignment — transactions start as Unassigned
          importedCount++
        } else {
          duplicatesSkipped++
        }
      } catch (err) {
        console.error('Failed to insert transaction:', err)
        duplicatesSkipped++
      }
    }

    // Update the statement with final counts
    await tx
      .update(statements)
      .set({ importedCount, duplicatesSkipped })
      .where(eq(statements.id, stmt!.id))
  })

  return c.json({
    success: true,
    data: {
      statementId: statementId!,
      parsedCount,
      importedCount,
      duplicatesSkipped,
    },
  }, 201)
})

// ─── DELETE /v1/statements/:id ───────────────────────────────────────────────

statementsRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const statementId = c.req.param('id')

  // Verify ownership
  const statement = await db.query.statements.findFirst({
    where: and(eq(statements.id, statementId), eq(statements.userId, userId)),
  })

  if (!statement) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Statement not found' } },
      404
    )
  }

  // Cascade delete: transactions FK has ON DELETE CASCADE for transactionOwners
  // and statementId in transactions is SET NULL on delete — we do a hard delete
  // of the transactions manually first so they don't become orphans
  await db.transaction(async (tx) => {
    // Delete transaction_owners via cascade (transactions FK cascades)
    await tx.delete(transactions).where(eq(transactions.statementId, statementId))
    await tx.delete(statements).where(eq(statements.id, statementId))
  })

  return c.json({ success: true, data: null })
})

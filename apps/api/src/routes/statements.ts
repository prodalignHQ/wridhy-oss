import { Hono } from 'hono'
import { db } from '@momoney/db'
import { statements, transactions, transactionOwners, owners, financialAccounts } from '@momoney/db'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createHash } from 'crypto'
import { getParser } from '@momoney/parsers'
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
  description: string
): string {
  const key = `${accountId}|${date.toISOString()}|${amount.toFixed(2)}|${description.slice(0, 50)}`
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
          message: `No parser found for bankId "${bankId}". Supported: icici_savings, icici_credit`,
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
    parsedTxns = parser.parse(buffer)
  } catch (err) {
    console.error('Parse error:', err)
    return c.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse statement file. Check the file format.' } },
      422
    )
  }

  const parsedCount = parsedTxns.length

  if (parsedCount === 0) {
    return c.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'No transactions found in the uploaded file.' } },
      422
    )
  }

  // Find the user's default ("Self") owner
  const selfOwner = await db.query.owners.findFirst({
    where: and(eq(owners.userId, userId), eq(owners.isDefault, true)),
  })
  if (!selfOwner) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Default owner not found' } },
      500
    )
  }

  // Compute dedup hashes for all parsed transactions
  const withHashes = parsedTxns.map((txn) => ({
    ...txn,
    dedupHash: computeDedupHash(accountId, txn.date, txn.amount, txn.description),
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
        const [inserted] = await tx
          .insert(transactions)
          .values({
            userId,
            accountId,
            statementId: stmt!.id,
            date: txnData.date,
            description: txnData.description,
            amount: txnData.amount.toFixed(2),
            type: txnData.type,
            dedupHash: txnData.dedupHash,
          })
          .onConflictDoNothing({ target: transactions.dedupHash })
          .returning()

        if (inserted) {
          // Auto-assign 100% to Self
          await tx.insert(transactionOwners).values({
            transactionId: inserted.id,
            ownerId: selfOwner.id,
            amount: txnData.amount.toFixed(2),
            percentage: '100.00',
          })
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

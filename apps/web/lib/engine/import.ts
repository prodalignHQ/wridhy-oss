// ─── Local-first statement import ───────────────────────────────────────────
// Parse → categorize → dedup → OPFS, all on-device. Returns immediately so
// the UI is instant and offline-capable; the caller then uploads the same
// file to the server in the background for backup. Convergence is by
// dedupHash (identical algorithm both sides), so the server copy determin-
// istically supersedes the local rows on the next cache refresh.

import { categorize, getDefaultMerchants } from '@momoney/rules-engine'
import {
  computeDedupHashBrowser,
  type LocalCategory,
  type LocalMerchant,
  type LocalRule,
  type LocalTransaction,
} from '@momoney/local-engine'
import { parseStatementFile } from './worker-client'
import { cacheServerRows, readLocalCache } from './opfs-db'

export interface LocalImportInput {
  bankId: string
  accountId: string
  /** YYYY-MM-01 */
  statementMonth: string
  file: File
  rules: LocalRule[]
  categories: LocalCategory[]
  userMerchants: LocalMerchant[]
}

export interface LocalImportResult {
  statementId: string
  parsedCount: number
  importedCount: number
  duplicatesSkipped: number
}

export async function importStatementLocal(input: LocalImportInput): Promise<LocalImportResult> {
  const rows = await parseStatementFile(input.bankId, input.file)
  const parsedCount = rows.length

  const categoryMap = new Map(input.categories.map((c) => [c.id, c]))
  const existing = await readLocalCache()
  const seenHashes = new Set((existing?.transactions ?? []).map((t) => t.dedupHash))

  // Local statement row (client UUID; superseded by the server row on sync).
  const statementId = crypto.randomUUID()
  const fresh: LocalTransaction[] = []
  let duplicatesSkipped = 0

  for (const row of rows) {
    const date = new Date(row.date)
    const dedupHash = await computeDedupHashBrowser(input.accountId, date, row.amount, row.description)
    if (seenHashes.has(dedupHash)) {
      duplicatesSkipped++
      continue
    }
    seenHashes.add(dedupHash)

    // Same categorize call as the server upload path.
    const result = categorize(
      { date, description: row.description, amount: row.amount, type: row.type },
      input.rules,
      Array.from(categoryMap.values()).map((c) => ({ id: c.id, name: c.name, color: c.color })),
      input.userMerchants,
      getDefaultMerchants()
    )
    const categoryId = result.categoryId || null

    fresh.push({
      id: crypto.randomUUID(),
      accountId: input.accountId,
      statementId,
      date: date.toISOString().slice(0, 10),
      description: row.description,
      // Mirror server merchant heuristic so rows converge.
      merchant: categoryId ? row.description.split(' ')[0] ?? null : null,
      amount: row.amount.toFixed(2),
      type: row.type,
      isOneTime: false,
      categoryId,
      comment: null,
      dedupHash,
    })
  }

  if (fresh.length > 0) {
    const written = await cacheServerRows({
      transactions: fresh,
      statements: [
        {
          id: statementId,
          accountId: input.accountId,
          bankId: input.bankId,
          statementMonth: input.statementMonth,
          parsedCount,
          importedCount: fresh.length,
          duplicatesSkipped,
        },
      ],
    })
    if (!written) {
      throw new Error('On-device database unavailable (OPFS/Worker failed) — nothing was saved')
    }
    // Read-back verification: the toast below must never lie.
    const { readLocalCache: verify } = await import('./opfs-db')
    const check = await verify().catch(() => null)
    const found = check?.transactions.filter((t) => t.statementId === statementId).length ?? 0
    if (found !== fresh.length) {
      throw new Error(`On-device save incomplete (wrote ${fresh.length}, found ${found})`)
    }
  }

  return { statementId, parsedCount, importedCount: fresh.length, duplicatesSkipped }
}

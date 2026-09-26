// ─── Worker client with main-thread fallback ────────────────────────────────

import { parseStatementLocal, type LocalPreviewRow } from './parse'
import type { ParserWorkerRequest, ParserWorkerResponse } from '@/workers/parser.worker'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (rows: LocalPreviewRow[]) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  try {
    if (!worker) {
      worker = new Worker(new URL('../../workers/parser.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<ParserWorkerResponse>) => {
        const entry = pending.get(e.data.id)
        if (!entry) return
        pending.delete(e.data.id)
        if (e.data.ok) entry.resolve(e.data.rows ?? [])
        else entry.reject(new Error(e.data.error ?? 'Worker parse failed'))
      }
      worker.onerror = (ev) => {
        console.warn('[local-engine] worker error, falling back to main thread', ev)
        for (const [, entry] of pending) entry.reject(new Error('Worker error'))
        pending.clear()
        try {
          worker?.terminate()
        } catch {
          // ignore
        }
        worker = null
      }
    }
    return worker
  } catch {
    return null
  }
}

/** Parse via Worker when possible, else main thread. Transferables avoid copying. */
export async function parseStatementFile(bankId: string, file: File): Promise<LocalPreviewRow[]> {
  const buffer = await file.arrayBuffer()
  const w = getWorker()
  if (!w) return parseStatementLocal(bankId, buffer)

  const id = ++seq
  const promise = new Promise<LocalPreviewRow[]>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    // Safety timeout: fall back to main thread after 60s.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        parseStatementLocal(bankId, buffer).then(resolve, reject)
      }
    }, 60_000)
  })
  const req: ParserWorkerRequest = { id, bankId, buffer: buffer.slice(0) }
  w.postMessage(req, { transfer: [req.buffer] })
  try {
    return await promise
  } catch {
    // Worker failed — retry on main thread once.
    return parseStatementLocal(bankId, await file.arrayBuffer())
  }
}

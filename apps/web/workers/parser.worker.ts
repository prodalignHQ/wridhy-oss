// ─── Statement parser Web Worker ────────────────────────────────────────────
// Keeps large XLSX/PDF parsing off the main thread. Falls back to main-thread
// parsing if Workers are unavailable (see worker-client.ts).

import { parseStatementLocal } from '@/lib/engine/parse'

export interface ParserWorkerRequest {
  id: number
  bankId: string
  buffer: ArrayBuffer
}

export interface ParserWorkerResponse {
  id: number
  ok: boolean
  rows?: Array<{ date: string; description: string; amount: number; type: 'debit' | 'credit' }>
  error?: string
}

self.onmessage = async (e: MessageEvent<ParserWorkerRequest>) => {
  const { id, bankId, buffer } = e.data
  try {
    const rows = await parseStatementLocal(bankId, buffer)
    const res: ParserWorkerResponse = { id, ok: true, rows }
    self.postMessage(res)
  } catch (err) {
    const res: ParserWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Parse failed',
    }
    self.postMessage(res)
  }
}

// ─── Browser PDF text extraction via pdfjs-dist ─────────────────────────────
// Replaces the Node-only `pdf-parse` path for web. Extracted lines are fed
// into the shared isomorphic `parseIciciPdfLines()` from @momoney/parsers.

import { parseIciciPdfLines, type ParsedTransaction } from '@momoney/parsers/browser'

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib = pdfjs as any
  try {
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
      // Next.js resolves this to a bundled asset URL.
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    }
  } catch {
    // If URL resolution fails, pdfjs falls back to the main thread.
  }
  return lib as {
    getDocument: (opts: { data: Uint8Array }) => {
      promise: Promise<{
        numPages: number
        getPage(n: number): Promise<{
          getTextContent(): Promise<{ items: Array<{ str: string; transform: number[] }> }>
        }>
        destroy(): Promise<void>
      }>
    }
  }
}

export async function parsePdfBufferBrowser(buffer: ArrayBuffer): Promise<ParsedTransaction[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  const lines: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    let line = ''
    let lastY: number | null = null
    for (const item of content.items) {
      const y = item.transform?.[5] ?? 0
      if (lastY !== null && Math.abs(y - lastY) > 2 && line.trim()) {
        lines.push(line)
        line = ''
      }
      line += (line ? ' ' : '') + item.str
      lastY = y
    }
    if (line.trim()) lines.push(line)
  }

  try {
    await doc.destroy()
  } catch {
    // ignore
  }
  return parseIciciPdfLines(lines)
}

// ─── Lazy SSF loader ─────────────────────────────────────────────────────────
// `SSF` (Excel date-code parser) is a named export of xlsx.mjs (browser) but
// is NOT statically detectable in xlsx.js (Node CJS) by module lexers, so a
// static `import { SSF }` breaks the server runtime while `(ns as any).default`
// breaks the Turbopack client build. Dynamic import works in both: ESM gives
// `m.SSF`, CJS-interop gives `m.default.SSF`.

export interface XlsxSSF {
  parse_date_code?: (serial: number) => {
    y: number
    m: number
    d: number
    H?: number
    M?: number
    S?: number
  } | null
}

let cached: Promise<XlsxSSF | null> | null = null

export function loadXlsxSSF(): Promise<XlsxSSF | null> {
  if (!cached) {
    cached = import('xlsx').then(
      (m: unknown) => {
        const mod = m as { SSF?: XlsxSSF; default?: { SSF?: XlsxSSF } }
        return mod.SSF ?? mod.default?.SSF ?? null
      },
      () => null
    )
  }
  return cached
}

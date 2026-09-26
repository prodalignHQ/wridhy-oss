// ─── Dedup hashing ──────────────────────────────────────────────────────────
// Must match apps/api/src/routes/statements.ts computeDedupHash exactly:
//   sha256(`${accountId}|${date.toISOString()}|${amount.toFixed(2)}|${description.slice(0,50)}`)
// Browser-safe: uses SubtleCrypto when available, falls back to FNV-1a for
// preview-only paths (server remains source of truth until vault sync lands).

export function dedupKey(
  accountId: string,
  date: Date,
  amount: number,
  description: string
): string {
  return `${accountId}|${date.toISOString()}|${amount.toFixed(2)}|${description.slice(0, 50)}`
}

export async function computeDedupHashBrowser(
  accountId: string,
  date: Date,
  amount: number,
  description: string
): Promise<string> {
  const key = dedupKey(accountId, date, amount, description)
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    // fall through to FNV
  }
  // Non-cryptographic fallback (preview only — do not rely on for import dedup
  // until SubtleCrypto is available, which it is in all secure contexts).
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < key.length; i++) {
    h1 = Math.imul(h1 ^ key.charCodeAt(i), 16777619)
    h2 = Math.imul(h2 + key.charCodeAt(i), 16777619)
  }
  return `fnv-${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`
}

/** Node/server parity helper (sync SHA-256 via node:crypto is done server-side). */
export function isFallbackHash(hash: string): boolean {
  return hash.startsWith('fnv-')
}

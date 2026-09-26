// ─── WebAuthn PRF key custody ────────────────────────────────────────────────
// Uses the WebAuthn PRF extension (draft-ietf / W3C WebAuthn-3) to turn a
// platform passkey into a 32-byte high-entropy KEK that wraps the vault DEK.
// No extra dependency: raw navigator.credentials calls with portable
// base64url helpers. Server involvement: zero (credential ID is stored in the
// opaque vault blob only as an allowCredentials hint).
//
// PRF eval input is derived deterministically from the vault's Argon2 salt:
//   SHA-256('MoMoney-Vault-PRF-v1' || salt)
// so no extra server column is needed and rotation follows salt rotation.

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  )
}

/** Best-effort PRF capability probe. False negatives possible → UI falls back. */
export async function isPrfSupported(): Promise<boolean> {
  try {
    if (!isWebAuthnAvailable()) return false
    const PKC = window.PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<{ prf?: boolean }>
    }
    if (typeof PKC.getClientCapabilities === 'function') {
      const caps = await PKC.getClientCapabilities()
      if (typeof caps?.prf === 'boolean') return caps.prf
    }
    // Older browsers: assume possible, let eval fail gracefully.
    return true
  } catch {
    return false
  }
}

export async function derivePrfInput(vaultSaltB64: string): Promise<Uint8Array> {
  // Accept standard base64 (vault column) or base64url — normalize first.
  const salt = b64urlToBytes(b64ToB64url(vaultSaltB64))
  const prefix = new TextEncoder().encode('MoMoney-Vault-PRF-v1')
  const combined = new Uint8Array(prefix.length + salt.length)
  combined.set(prefix)
  combined.set(salt, prefix.length)
  const digest = await crypto.subtle.digest('SHA-256', combined)
  return new Uint8Array(digest)
}

export interface PrfRegistration {
  credentialIdB64url: string
}

/** Register a new passkey. PRF evaluability is exercised at unlock, not here. */
export async function registerPrfCredential(userName: string): Promise<PrfRegistration> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(32))
  const rpId = window.location.hostname

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      rp: { name: 'MoMoney', id: rpId },
      user: {
        id: userId.buffer as ArrayBuffer,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      timeout: 120_000,
      attestation: 'none',
      extensions: { prf: {} },
    },
  })) as unknown as { rawId: ArrayBuffer } | null

  if (!cred) throw new Error('Passkey registration was cancelled or failed')
  return { credentialIdB64url: bytesToB64url(new Uint8Array(cred.rawId)) }
}

/** Evaluate PRF against a registered credential → 32-byte KEK. */
export async function evalPrf(credentialIdB64url: string, prfInput: Uint8Array): Promise<Uint8Array> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      allowCredentials: [{ id: b64urlToBytes(credentialIdB64url).buffer as ArrayBuffer, type: 'public-key' }],
      userVerification: 'preferred',
      timeout: 120_000,
      extensions: { prf: { eval: { first: prfInput.buffer as ArrayBuffer } } },
    },
  })) as unknown as {
    getClientExtensionResults?: () => { prf?: { results?: { first?: ArrayBuffer } } }
  } | null

  if (!assertion) throw new Error('Passkey authentication was cancelled or failed')
  const first = assertion.getClientExtensionResults?.()?.prf?.results?.first
  if (!first || first.byteLength !== 32) {
    throw new Error('This passkey does not support the PRF extension')
  }
  return new Uint8Array(first)
}

// ─── Portable base64url ──────────────────────────────────────────────────────

const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function bytesToB64url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64U[(n >> 18) & 63]! + B64U[(n >> 12) & 63]!
    if (i + 1 < bytes.length) out += B64U[(n >> 6) & 63]!
    if (i + 2 < bytes.length) out += B64U[n & 63]!
  }
  return out
}

export function b64urlToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9\-_]/g, '')
  const out: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64U.indexOf(clean[i]!)
    const c1 = B64U.indexOf(clean[i + 1] ?? 'A')
    const c2 = clean[i + 2] === undefined ? 0 : B64U.indexOf(clean[i + 2]!)
    const c3 = clean[i + 3] === undefined ? 0 : B64U.indexOf(clean[i + 3]!)
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    out.push((n >> 16) & 255)
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 255)
    if (clean[i + 3] !== undefined) out.push(n & 255)
  }
  return new Uint8Array(out)
}

/** Standard-base64 (with +/=) → base64url tolerant decoder for vault fields. */
export function b64ToB64url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

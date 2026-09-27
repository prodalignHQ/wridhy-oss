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

/** Human device label for passkey registration ("Mac · Chrome"). */
export function suggestDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey'
  const ua = navigator.userAgent
  const os = ua.includes('Mac')
    ? 'Mac'
    : ua.includes('Windows')
      ? 'Windows'
      : ua.includes('Android')
        ? 'Android'
        : ua.includes('iPhone') || ua.includes('iPad')
          ? 'iPhone'
          : 'Device'
  const browser = ua.includes('Chrome')
    ? 'Chrome'
    : ua.includes('Safari')
      ? 'Safari'
      : ua.includes('Firefox')
        ? 'Firefox'
        : 'Browser'
  return `${os} · ${browser}`
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

/** Thrown when the user dismisses an authenticator prompt (or the browser
 * rejects it for gesture/timing reasons). Callers should treat this as
 * "try again", NOT as missing PRF support — silently returning to idle. */
export class PrfCancelledError extends Error {
  constructor(message = 'Passkey prompt was dismissed') {
    super(message)
    this.name = 'PrfCancelledError'
  }
}

/** True for user-dismissed ceremonies (never surface these as errors). */
export function isPasskeyCancel(err: unknown): boolean {
  return err instanceof PrfCancelledError || (err as { name?: string } | null)?.name === 'PrfCancelledError'
}

function isCancelError(err: unknown): boolean {
  if (err === null || err === undefined) return true
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'NotAllowedError' || err.name === 'AbortError'
  }
  const name = (err as { name?: string }).name ?? ''
  return name === 'NotAllowedError' || name === 'AbortError'
}

/** Register a new passkey. PRF evaluability is exercised at unlock, not here. */
export async function registerPrfCredential(userName: string): Promise<PrfRegistration> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(32))
  const rpId = window.location.hostname

  let cred: { rawId: ArrayBuffer } | null
  try {
    cred = (await navigator.credentials.create({
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
  } catch (err) {
    if (isCancelError(err)) throw new PrfCancelledError()
    throw err
  }

  if (!cred) throw new PrfCancelledError()
  return { credentialIdB64url: bytesToB64url(new Uint8Array(cred.rawId)) }
}

/** Single PRF evaluation attempt. Classifies failures; never retries. */
async function evalPrfOnce(credentialIdB64url: string, prfInput: Uint8Array): Promise<Uint8Array> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  let assertion: {
    getClientExtensionResults?: () => { prf?: { results?: { first?: ArrayBuffer } } }
  } | null
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: challenge.buffer as ArrayBuffer,
        allowCredentials: [{ id: b64urlToBytes(credentialIdB64url).buffer as ArrayBuffer, type: 'public-key' }],
        userVerification: 'preferred',
        timeout: 120_000,
        extensions: { prf: { eval: { first: prfInput.buffer as ArrayBuffer } } },
      },
    })) as unknown as typeof assertion
  } catch (err) {
    if (isCancelError(err)) throw new PrfCancelledError()
    throw err
  }

  if (!assertion) throw new PrfCancelledError()
  const first = assertion.getClientExtensionResults?.()?.prf?.results?.first
  if (!first || first.byteLength !== 32) {
    // Ceremony SUCCEEDED but no PRF output: the authenticator genuinely
    // lacks PRF. This — and only this — means "unsupported".
    throw new Error('UNSUPPORTED_PRF')
  }
  return new Uint8Array(first)
}

/**
 * Evaluate PRF with retries. A just-registered credential (Chrome profile
 * keys especially) may not resolve in an immediately-following get() —
 * credential propagation/timing flakes that vanish on retry. Only a
 * ceremony that SUCCEEDS without PRF output counts as unsupported;
 * cancellations propagate immediately (never re-prompt after a dismiss).
 */
export async function evalPrf(credentialIdB64url: string, prfInput: Uint8Array): Promise<Uint8Array> {
  const delays = [0, 800, 1600]
  let lastError: unknown = null
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]))
    }
    try {
      return await evalPrfOnce(credentialIdB64url, prfInput)
    } catch (err) {
      if (err instanceof PrfCancelledError) throw err
      if (err instanceof Error && err.message === 'UNSUPPORTED_PRF') {
        throw new Error('This passkey does not support the PRF extension')
      }
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('PRF evaluation failed — please retry')
}

/**
 * Register + prove PRF in one call (two authenticator taps: create, then
 * verify). Used by onboarding and add-device flows so neither duplicates
 * the retry/classify logic.
 */
export async function registerAndProvePrf(
  userName: string,
  saltB64: string
): Promise<{ credentialIdB64url: string; prfOutput: Uint8Array }> {
  const { credentialIdB64url } = await registerPrfCredential(userName)
  const prfOutput = await evalPrf(credentialIdB64url, await derivePrfInput(saltB64))
  return { credentialIdB64url, prfOutput }
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

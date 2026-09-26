// ─── Vault cryptography ─────────────────────────────────────────────────────
// Client-side only. The server never sees keys or plaintext.
//
// Key hierarchy:
//   password ──Argon2id(salt)──▶ KEK-pw ──┐
//   PRF output (32B passkey) ────────────▶ KEK-prf ──┼─secretbox──▶ DEK (32B random)
//   recovery code ──Argon2id(salt)──▶ KEK-rec ───────┘
//   DEK ──XChaCha20-Poly1305──▶ snapshot ciphertext
//
// Primitives: hash-wasm (Argon2id) + @noble/ciphers (XChaCha20-Poly1305,
// XSalsa20-Poly1305 secretbox). ESM-native, audited, no WASM-loader ceremony,
// and portable to Workers / React Native later. (libsodium-wrappers was
// evaluated first but its 0.7.16 ESM entry is broken.)
//
// Envelope encodings are standard base64 so the API stores them as TEXT.
// DB columns `opslimit`/`memlimit` carry Argon2 `iterations`/`memorySize(KiB)`.

import { argon2id } from 'hash-wasm'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js'
import { bytesToHex, bytesToUtf8, concatBytes, hexToBytes, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js'
import type { VaultSnapshot } from './storage.js'

export interface VaultParams {
  saltB64: string
  /** Argon2 iterations (stored in DB `opslimit`) */
  iterations: number
  /** Argon2 memory in KiB (stored in DB `memlimit`) */
  memorySize: number
}

/** Fresh Argon2 parameters. ~64MB/3 passes keeps unlock ≈1s on desktop/mobile. */
export function createVaultParams(): VaultParams {
  return {
    saltB64: b64encode(randomBytes(16)),
    iterations: 3,
    memorySize: 65536,
  }
}

/** Argon2id(password, salt) → 32-byte KEK. */
export async function deriveKek(password: string, params: VaultParams): Promise<Uint8Array> {
  const out = await argon2id({
    password,
    salt: b64decode(params.saltB64),
    parallelism: 1,
    iterations: params.iterations,
    memorySize: params.memorySize,
    hashLength: 32,
    outputType: 'binary',
  })
  return out as Uint8Array
}

export function generateDek(): Uint8Array {
  return randomBytes(32)
}

/** secretbox(DEK, KEK) → base64(nonce24 || box). Authenticated: wrong KEK throws. */
export function wrapDek(dek: Uint8Array, kek: Uint8Array): string {
  const nonce = randomBytes(24)
  const box = xsalsa20poly1305(kek, nonce).encrypt(dek)
  return b64encode(concatBytes(nonce, box))
}

/** Inverse of wrapDek. Throws on tamper or wrong key. */
export function unwrapDek(wrappedB64: string, kek: Uint8Array): Uint8Array {
  const combined = b64decode(wrappedB64)
  const nonce = combined.slice(0, 24)
  const box = combined.slice(24)
  return xsalsa20poly1305(kek, nonce).decrypt(box)
}

// ─── Snapshot envelope ───────────────────────────────────────────────────────

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = canonicalize((value as Record<string, unknown>)[k])
    }
    return sorted
  }
  return value
}

export function encryptSnapshot(
  snapshot: VaultSnapshot,
  dek: Uint8Array
): { cipherB64: string; nonceB64: string } {
  const plaintext = utf8ToBytes(JSON.stringify(canonicalize(snapshot)))
  const nonce = randomBytes(24)
  const cipher = xchacha20poly1305(dek, nonce).encrypt(plaintext)
  return { cipherB64: b64encode(cipher), nonceB64: b64encode(nonce) }
}

export function decryptSnapshot(cipherB64: string, nonceB64: string, dek: Uint8Array): VaultSnapshot {
  const plaintext = xchacha20poly1305(dek, b64decode(nonceB64)).decrypt(b64decode(cipherB64))
  return JSON.parse(bytesToUtf8(plaintext)) as VaultSnapshot
}

// ─── Raw byte seal (OPFS file-at-rest) ───────────────────────────────────────
// Same DEK, raw bytes instead of JSON. Used to seal the live OPFS SQLite file
// on lock: OPFS holds only XChaCha20-Poly1305 ciphertext while locked.

export function sealBytes(plain: Uint8Array, dek: Uint8Array): { cipherB64: string; nonceB64: string } {
  const nonce = randomBytes(24)
  return { cipherB64: b64encode(xchacha20poly1305(dek, nonce).encrypt(plain)), nonceB64: b64encode(nonce) }
}

export function unsealBytes(cipherB64: string, nonceB64: string, dek: Uint8Array): Uint8Array {
  return xchacha20poly1305(dek, b64decode(nonceB64)).decrypt(b64decode(cipherB64))
}

// ─── Recovery codes ──────────────────────────────────────────────────────────
// 128-bit entropy, displayed grouped for transcription. KEK = Argon2id(code).

export function createRecoveryCode(): string {
  const hex = bytesToHex(randomBytes(16))
  return [hex.slice(0, 8), hex.slice(8, 16), hex.slice(16, 24), hex.slice(24, 32)].join('-')
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^0-9a-f]/g, '')
}

// ─── Portable base64 (no atob/Buffer — runs in Workers too) ─────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function b64encode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

export function b64decode(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  const out: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]!) << 18) |
      (B64.indexOf(clean[i + 1]!) << 12) |
      ((clean[i + 2] === '=' ? 0 : B64.indexOf(clean[i + 2]!)) << 6) |
      (clean[i + 3] === '=' ? 0 : B64.indexOf(clean[i + 3]!))
    out.push((n >> 16) & 255)
    if (clean[i + 2] !== '=') out.push((n >> 8) & 255)
    if (clean[i + 3] !== '=') out.push(n & 255)
  }
  return new Uint8Array(out)
}

export { hexToBytes }

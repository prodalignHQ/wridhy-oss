// ─── Vault sync client ───────────────────────────────────────────────────────
// Orchestrates: setup (password → DEK + wraps + encrypted snapshot → PUT),
// unlock (password | passkey | recovery → DEK), lock (wipe DEK), sync.
// DEK lives only in the in-memory vault store — never localStorage/IndexedDB.

import { apiClient } from '@/lib/api'
import {
  createRecoveryCode,
  createVaultParams,
  decryptSnapshot,
  deriveKek,
  encryptSnapshot,
  generateDek,
  normalizeRecoveryCode,
  unwrapDek,
  wrapDek,
  type VaultParams,
  type VaultSnapshot,
} from '@momoney/local-engine'
import { derivePrfInput, evalPrf, registerPrfCredential } from './webauthn-prf'

export interface VaultBlob {
  userId?: string
  cipher: string
  nonce: string
  salt: string
  opslimit: number
  memlimit: number
  wrappedDekPassword: string | null
  wrappedDekPrf: string | null
  prfCredentialId: string | null
  wrappedDekRecovery: string | null
  version: number
  updatedAt?: string
}

export class VaultError extends Error {
  code: 'NO_VAULT' | 'NO_WRAP' | 'DECRYPT_FAILED' | 'PRF_UNSUPPORTED'
  constructor(code: VaultError['code'], message: string) {
    super(message)
    this.code = code
  }
}

function paramsFromBlob(blob: VaultBlob): VaultParams {
  return { saltB64: blob.salt, iterations: blob.opslimit, memorySize: blob.memlimit }
}

export async function fetchVaultBlob(): Promise<VaultBlob | null> {
  try {
    return await apiClient.fetch<VaultBlob>('/v1/vault')
  } catch (err) {
    if ((err as { code?: string }).code === 'NO_VAULT') return null
    throw err
  }
}

async function pushBlob(blob: Omit<VaultBlob, 'userId' | 'updatedAt'>): Promise<void> {
  await apiClient.fetch('/v1/vault', {
    method: 'PUT',
    body: JSON.stringify(blob),
  })
}

/** First-time setup: password → params + DEK + password/recovery wraps + snapshot. */
export async function setupVaultWithPassword(
  password: string,
  snapshot: VaultSnapshot
): Promise<{ blob: VaultBlob; recoveryCode: string; dek: Uint8Array }> {
  if (password.length < 12) throw new VaultError('DECRYPT_FAILED', 'Password must be at least 12 characters')
  const params = createVaultParams()
  const dek = generateDek()
  const kekPw = await deriveKek(password, params)
  const recoveryCode = createRecoveryCode()
  const kekRec = await deriveKek(normalizeRecoveryCode(recoveryCode), params)
  const [wrappedDekPassword, wrappedDekRecovery, env] = await Promise.all([
    wrapDek(dek, kekPw),
    wrapDek(dek, kekRec),
    encryptSnapshot(snapshot, dek),
  ])
  const blob: VaultBlob = {
    cipher: env.cipherB64,
    nonce: env.nonceB64,
    salt: params.saltB64,
    opslimit: params.iterations,
    memlimit: params.memorySize,
    wrappedDekPassword,
    wrappedDekPrf: null,
    prfCredentialId: null,
    wrappedDekRecovery,
    version: 1,
  }
  await pushBlob(blob)
  return { blob, recoveryCode, dek }
}

export async function unlockWithPassword(blob: VaultBlob, password: string): Promise<Uint8Array> {
  if (!blob.wrappedDekPassword) throw new VaultError('NO_WRAP', 'No password unlock registered on this vault')
  const kek = await deriveKek(password, paramsFromBlob(blob))
  try {
    return await unwrapDek(blob.wrappedDekPassword, kek)
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Incorrect password')
  }
}

/** Register a passkey and add its PRF wrap. Requires the DEK (i.e. unlocked). */
export async function registerPasskey(
  blob: VaultBlob,
  dek: Uint8Array,
  userName: string
): Promise<VaultBlob> {
  const { credentialIdB64url } = await registerPrfCredential(userName)
  // Verify the credential can actually evaluate PRF before storing the wrap.
  const prfInput = await derivePrfInput(blob.salt)
  let prfOut: Uint8Array
  try {
    prfOut = await evalPrf(credentialIdB64url, prfInput)
  } catch {
    throw new VaultError('PRF_UNSUPPORTED', 'This passkey does not support the PRF extension')
  }
  const updated: VaultBlob = {
    ...blob,
    wrappedDekPrf: wrapDek(dek, prfOut),
    prfCredentialId: credentialIdB64url,
  }
  await pushBlob(updated)
  return updated
}

export async function unlockWithPasskey(blob: VaultBlob): Promise<Uint8Array> {
  if (!blob.wrappedDekPrf || !blob.prfCredentialId) {
    throw new VaultError('NO_WRAP', 'No passkey registered on this vault')
  }
  const prfInput = await derivePrfInput(blob.salt)
  let prfOut: Uint8Array
  try {
    prfOut = await evalPrf(blob.prfCredentialId, prfInput)
  } catch {
    throw new VaultError('PRF_UNSUPPORTED', 'PRF evaluation failed on this device')
  }
  try {
    return await unwrapDek(blob.wrappedDekPrf, prfOut)
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Passkey did not unlock this vault')
  }
}

export async function unlockWithRecovery(blob: VaultBlob, code: string): Promise<Uint8Array> {
  if (!blob.wrappedDekRecovery) throw new VaultError('NO_WRAP', 'No recovery code registered on this vault')
  const kek = await deriveKek(normalizeRecoveryCode(code), paramsFromBlob(blob))
  try {
    return await unwrapDek(blob.wrappedDekRecovery, kek)
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Incorrect recovery code')
  }
}

/** Re-encrypt + upload the current snapshot. Requires the DEK (unlocked). */
export async function syncSnapshot(blob: VaultBlob, dek: Uint8Array, snapshot: VaultSnapshot): Promise<VaultBlob> {
  const env = await encryptSnapshot(snapshot, dek)
  const updated: VaultBlob = { ...blob, cipher: env.cipherB64, nonce: env.nonceB64 }
  await pushBlob(updated)
  return updated
}

export async function decryptVaultSnapshot(blob: VaultBlob, dek: Uint8Array): Promise<VaultSnapshot> {
  try {
    return await decryptSnapshot(blob.cipher, blob.nonce, dek)
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Vault ciphertext failed authentication')
  }
}

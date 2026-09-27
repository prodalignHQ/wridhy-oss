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
import type { LocalCache } from './opfs-db'

/** Shape the OPFS cache into the encrypted-sync snapshot (all tables). */
export function buildVaultSnapshot(cache: LocalCache): VaultSnapshot {
  return {
    transactions: cache.transactions,
    categories: cache.categories,
    statements: cache.statements,
    owners: cache.transactionOwners,
    financialAccounts: cache.accounts,
    ownerList: cache.owners,
    rules: cache.rules,
    merchants: cache.merchants,
    invoices: cache.invoices,
    invoiceStatements: cache.invoiceStatements,
    invoiceItems: cache.invoiceItems,
    updatedAt: new Date().toISOString(),
  }
}

export interface VaultWrap {
  credentialId: string
  wrappedDek: string
  label: string
  createdAt: string
}

export interface VaultBlob {
  userId?: string
  cipher: string
  nonce: string
  salt: string
  opslimit: number
  memlimit: number
  wrappedDekPassword: string | null
  wrappedDekRecovery: string | null
  version: number
  updatedAt?: string
  /** Per-device passkey wraps (PRF output is device-bound). */
  wraps: VaultWrap[]
}

export class VaultError extends Error {
  code: 'NO_VAULT' | 'NO_WRAP' | 'DECRYPT_FAILED' | 'PRF_UNSUPPORTED' | 'CONFLICT'
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

async function pushBlob(blob: Omit<VaultBlob, 'userId' | 'updatedAt' | 'wraps'>): Promise<void> {
  const { wraps: _wraps, ...body } = blob as VaultBlob & { wraps?: unknown }
  void _wraps
  await apiClient.fetch('/v1/vault', {
    method: 'PUT',
    body: JSON.stringify(body),
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
    wrappedDekRecovery,
    version: 1,
    wraps: [],
  }
  await pushBlob(blob)
  return { blob, recoveryCode, dek }
}

export interface PasskeySetupWrap {
  credentialId: string
  label: string
  /** Resolved PRF output (32 B). Wiped by this function after use. */
  prfOutput: Uint8Array
}

/**
 * Passkey setup: DEK wrapped by one or more passkey PRF outputs plus a
 * mandatory recovery wrap. A password wrap is ALSO mandatory (policy since
 * onboarding v2): passkeys are device-bound, so the password is the portable
 * knowledge factor that lets a new device join without retyping a recovery
 * code. Pass `passwordKek` (derived by the caller, wiped after use).
 */
export async function setupVaultWithPasskeys(
  passkeys: PasskeySetupWrap[],
  snapshot: VaultSnapshot,
  params: VaultParams = createVaultParams(),
  passwordKek: Uint8Array | null = null
): Promise<{ blob: VaultBlob; recoveryCode: string; dek: Uint8Array; wrapError: string | null }> {
  if (passkeys.length === 0) throw new VaultError('NO_WRAP', 'At least one passkey is required')
  if (!passwordKek) throw new VaultError('NO_WRAP', 'A vault password is required (it is what new devices join with)')
  const dek = generateDek()
  const recoveryCode = createRecoveryCode()
  const kekRec = await deriveKek(normalizeRecoveryCode(recoveryCode), params)
  const env = await encryptSnapshot(snapshot, dek)
  const blob: VaultBlob = {
    cipher: env.cipherB64,
    nonce: env.nonceB64,
    salt: params.saltB64,
    opslimit: params.iterations,
    memlimit: params.memorySize,
    wrappedDekPassword: await wrapDek(dek, passwordKek),
    wrappedDekRecovery: await wrapDek(dek, kekRec),
    version: 1,
    wraps: [],
  }
  passwordKek.fill(0)
  await pushBlob(blob)
  // Store each per-device wrap independently. The recovery wrap is already
  // stored, so a failing authenticator degrades (warning) instead of
  // stranding the vault — the recovery code always unlocks.
  const wraps: VaultBlob['wraps'] = []
  let wrapError: string | null = null
  for (const pk of passkeys) {
    try {
      const wrappedDek = wrapDek(dek, pk.prfOutput)
      const saved = await apiClient.fetch<{ credentialId: string; label: string; createdAt: string }>(
        '/v1/vault/wraps',
        {
          method: 'POST',
          body: JSON.stringify({ credentialId: pk.credentialId, wrappedDek, label: pk.label }),
        }
      )
      wraps.push({ credentialId: saved.credentialId, wrappedDek, label: saved.label, createdAt: saved.createdAt })
    } catch (err) {
      wrapError = err instanceof Error ? err.message : 'Passkey wrap failed'
    } finally {
      pk.prfOutput.fill(0)
    }
  }
  return { blob: { ...blob, wraps }, recoveryCode, dek, wrapError }
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

/** Add a password wrap to a vault that lacks one (e.g. early passkey-only
 * vaults). PUT is full-replace, so every existing field is re-sent; the
 * wraps table is untouched by PUT. Requires the DEK (unlocked). */
export async function addPasswordWrap(
  blob: VaultBlob,
  dek: Uint8Array,
  password: string
): Promise<VaultBlob> {
  if (password.length < 12) throw new VaultError('DECRYPT_FAILED', 'Password must be at least 12 characters')
  const kek = await deriveKek(password, paramsFromBlob(blob))
  const updated: VaultBlob = { ...blob, wrappedDekPassword: await wrapDek(dek, kek) }
  kek.fill(0)
  await pushBlob(updated)
  return updated
}

/** Register a passkey and store its per-device PRF wrap. Requires the DEK (unlocked). */
export async function registerPasskey(
  blob: VaultBlob,
  dek: Uint8Array,
  userName: string,
  label: string
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
  const wrappedDek = wrapDek(dek, prfOut)
  prfOut.fill(0)
  const saved = await apiClient.fetch<{ credentialId: string; label: string; createdAt: string }>(
    '/v1/vault/wraps',
    {
      method: 'POST',
      body: JSON.stringify({ credentialId: credentialIdB64url, wrappedDek, label }),
    }
  )
  const wraps = [
    ...blob.wraps.filter((w) => w.credentialId !== saved.credentialId),
    { credentialId: saved.credentialId, wrappedDek, label: saved.label, createdAt: saved.createdAt },
  ]
  return { ...blob, wraps }
}

export async function unlockWithPasskey(blob: VaultBlob, credentialId?: string): Promise<Uint8Array> {
  const wraps = blob.wraps ?? []
  const target =
    (credentialId ? wraps.find((w) => w.credentialId === credentialId) : undefined) ??
    (wraps.length === 1 ? wraps[0] : undefined)
  if (!target) {
    throw new VaultError('NO_WRAP', 'No matching passkey registered on this vault')
  }
  const prfInput = await derivePrfInput(blob.salt)
  let prfOut: Uint8Array
  try {
    prfOut = await evalPrf(target.credentialId, prfInput)
  } catch {
    throw new VaultError('PRF_UNSUPPORTED', 'PRF evaluation failed on this device')
  }
  try {
    const dek = await unwrapDek(target.wrappedDek, prfOut)
    return dek
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Passkey did not unlock this vault')
  } finally {
    prfOut.fill(0)
  }
}

/** Revoke a device's passkey wrap (removes future unlocks from that device). */
export async function revokePasskey(blob: VaultBlob, credentialId: string): Promise<VaultBlob> {
  await apiClient.fetch(`/v1/vault/wraps/${encodeURIComponent(credentialId)}`, { method: 'DELETE' })
  return { ...blob, wraps: blob.wraps.filter((w) => w.credentialId !== credentialId) }
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

/**
 * Encrypted backup via POST /v1/vault/sync (version-guarded, ciphertext-only).
 * Retries once after refetching on CONFLICT. Returns the updated blob.
 */
export async function syncEncryptedSnapshot(
  blob: VaultBlob,
  dek: Uint8Array,
  snapshot: VaultSnapshot
): Promise<VaultBlob> {
  const attempt = async (base: VaultBlob): Promise<VaultBlob> => {
    const env = await encryptSnapshot(snapshot, dek)
    try {
      const saved = await apiClient.fetch<{ version: number; updatedAt: string }>('/v1/vault/sync', {
        method: 'POST',
        body: JSON.stringify({ cipher: env.cipherB64, nonce: env.nonceB64, baseVersion: base.version }),
      })
      return { ...base, cipher: env.cipherB64, nonce: env.nonceB64, version: saved.version, updatedAt: saved.updatedAt }
    } catch (err) {
      if ((err as { code?: string }).code === 'CONFLICT') {
        throw new VaultError('CONFLICT', 'Vault changed on the server. Refresh and retry.')
      }
      throw err
    }
  }

  try {
    return await attempt(blob)
  } catch (err) {
    if (err instanceof VaultError && err.code === 'CONFLICT') {
      const fresh = await fetchVaultBlob()
      if (!fresh) throw new VaultError('NO_VAULT', 'Vault disappeared from the server')
      return await attempt(fresh)
    }
    throw err
  }
}

export async function decryptVaultSnapshot(blob: VaultBlob, dek: Uint8Array): Promise<VaultSnapshot> {
  try {
    return await decryptSnapshot(blob.cipher, blob.nonce, dek)
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Vault ciphertext failed authentication')
  }
}

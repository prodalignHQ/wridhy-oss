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
  normalizeVaultParams,
  unwrapDek,
  wrapDek,
  type VaultParams,
  type VaultSnapshot,
} from '@momoney/local-engine'
import { derivePrfInput, evalPrf, registerAndProvePrf, PrfCancelledError } from './webauthn-prf'
import type { LocalCache } from './opfs-db'

/** Shape the OPFS cache into the encrypted-sync snapshot (all tables). */
export function buildVaultSnapshot(cache: LocalCache): VaultSnapshot {
  // NOTE: every array on LocalCache MUST be mapped here. These fields are
  // optional on VaultSnapshot (old vaults predate them), so TypeScript will
  // NOT catch an omission — and the result is a silent data gap exactly like
  // the net-worth 0-count incident. When adding a table: types.ts,
  // opfs-schema.ts, db.worker readAll, opfs-db mappings, analytics-client
  // fetch, AND this function.
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
    assets: cache.assets,
    liabilities: cache.liabilities,
    netWorthSnapshots: cache.netWorthSnapshots,
    netWorthDrafts: cache.netWorthDrafts,
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

/**
 * Unlock metadata cache (offline unlock support). Stores everything needed
 * to derive and unwrap EXCEPT the snapshot ciphertext and the DEK: salt,
 * params, wraps. Written on every blob update (see store subscription);
 * read when the API is unreachable. Ciphertext then comes from the sealed
 * OPFS file, and the snapshot is rebuilt from OPFS after unseal.
 */
const VAULT_META_KEY = 'momoney_vault_meta'

export function writeCachedVaultMeta(blob: VaultBlob): void {
  try {
    if (typeof window === 'undefined') return
    const { cipher: _c, nonce: _n, ...meta } = blob
    void _c
    void _n
    localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta))
  } catch {
    // private mode — offline unlock simply won't be available
  }
}

export function readCachedVaultMeta(): VaultBlob | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(VAULT_META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as {
      salt?: unknown
      opslimit?: unknown
      memlimit?: unknown
      wrappedDekPassword?: unknown
      wrappedDekRecovery?: unknown
      version?: unknown
      updatedAt?: unknown
      wraps?: unknown
      cipher?: unknown
      nonce?: unknown
    }
    if (typeof meta.salt !== 'string' || !meta.salt) return null
    if (typeof meta.opslimit !== 'number' || typeof meta.memlimit !== 'number') return null
    const asText = (v: unknown): string | null => (typeof v === 'string' ? v : null)
    const wraps = Array.isArray(meta.wraps)
      ? (meta.wraps as Array<Record<string, unknown>>).map((w) => ({
          credentialId: String(w['credentialId'] ?? ''),
          wrappedDek: String(w['wrappedDek'] ?? ''),
          label: String(w['label'] ?? 'Passkey'),
          createdAt: String(w['createdAt'] ?? ''),
        }))
      : []
    return {
      cipher: asText(meta.cipher) ?? '',
      nonce: asText(meta.nonce) ?? '',
      salt: meta.salt,
      opslimit: meta.opslimit,
      memlimit: meta.memlimit,
      wrappedDekPassword: asText(meta.wrappedDekPassword),
      wrappedDekRecovery: asText(meta.wrappedDekRecovery),
      version: typeof meta.version === 'number' ? meta.version : 1,
      updatedAt: asText(meta.updatedAt) ?? undefined,
      wraps,
    }
  } catch {
    return null
  }
}

export function clearCachedVaultMeta(): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(VAULT_META_KEY)
  } catch {
    // ignore
  }
}

export class VaultError extends Error {
  code: 'NO_VAULT' | 'NO_WRAP' | 'DECRYPT_FAILED' | 'PRF_UNSUPPORTED' | 'CONFLICT'
  /** Which stage failed: key derivation (environment/KDF) vs unwrap (wrong key). */
  stage?: 'derive' | 'unwrap' | 'decrypt'
  constructor(code: VaultError['code'], message: string, stage?: VaultError['stage']) {
    super(message)
    this.code = code
    this.stage = stage
  }
}

function paramsFromBlob(blob: VaultBlob): VaultParams {
  const { iterations, memorySize } = normalizeVaultParams(blob.opslimit, blob.memlimit)
  return { saltB64: blob.salt, iterations, memorySize }
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
  let kek: Uint8Array
  try {
    kek = await deriveKek(password, paramsFromBlob(blob))
  } catch (err) {
    console.debug('[vault] KDF failed during password unlock', {
      opslimit: blob.opslimit,
      memlimit: blob.memlimit,
      saltLen: blob.salt?.length,
      wrapLen: blob.wrappedDekPassword?.length,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new VaultError(
      'DECRYPT_FAILED',
      'Key derivation failed on this device (Argon2 could not run) — try another browser, not another password',
      'derive'
    )
  }
  try {
    const dek = await unwrapDek(blob.wrappedDekPassword, kek)
    return dek
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Incorrect password', 'unwrap')
  } finally {
    kek.fill(0)
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
  // Cancellations propagate untouched (callers return to idle silently);
  // only genuine failures become PRF_UNSUPPORTED.
  let proven: { credentialIdB64url: string; prfOutput: Uint8Array }
  try {
    proven = await registerAndProvePrf(userName, blob.salt)
  } catch (err) {
    if (err instanceof PrfCancelledError) throw err
    if (err instanceof Error && err.message === 'This passkey does not support the PRF extension') {
      throw new VaultError('PRF_UNSUPPORTED', err.message)
    }
    throw err
  }
  const { credentialIdB64url, prfOutput } = proven
  const wrappedDek = wrapDek(dek, prfOutput)
  prfOutput.fill(0)
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
  } catch (err) {
    if (err instanceof PrfCancelledError) throw err
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
  let kek: Uint8Array
  try {
    kek = await deriveKek(normalizeRecoveryCode(code), paramsFromBlob(blob))
  } catch (err) {
    console.debug('[vault] KDF failed during recovery unlock', {
      opslimit: blob.opslimit,
      memlimit: blob.memlimit,
      saltLen: blob.salt?.length,
      wrapLen: blob.wrappedDekRecovery?.length,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new VaultError(
      'DECRYPT_FAILED',
      'Key derivation failed on this device (Argon2 could not run) — try another browser, not another code',
      'derive'
    )
  }
  try {
    const dek = await unwrapDek(blob.wrappedDekRecovery, kek)
    return dek
  } catch {
    throw new VaultError('DECRYPT_FAILED', 'Incorrect recovery code', 'unwrap')
  } finally {
    kek.fill(0)
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

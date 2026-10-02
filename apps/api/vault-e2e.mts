// E2E: opaque vault store round-trip against momoney_db_secure.
// 1. Real signup + verified session.
// 2. Builds a REAL encrypted envelope with @momoney/local-engine crypto.
// 3. PUT → GET (byte-compare) → client decrypt → per-device wraps (register,
//    list, per-device unwrap, cross-unwrap rejection, revoke) → versioned
//    sync → stale-write conflict → DELETE → GET (NO_VAULT).
// 4. Cleans up the test user.
import 'dotenv/config'
import { randomBytes, randomUUID } from 'crypto'
import { db, users, vaultBlobs, vaultWraps } from '@momoney/db'
import { eq } from 'drizzle-orm'
import {
  createVaultParams,
  deriveKek,
  generateDek,
  wrapDek,
  encryptSnapshot,
  decryptSnapshot,
  unwrapDek,
} from '@momoney/local-engine'

const BASE = 'http://localhost:3001'

async function main() {
  const email = `vault-e2e-${Date.now()}@example.com`
  const password = 'E2eTestPassword123!'

  // Real signup flow (exercises better-auth cookies end to end).
  const authHeaders = { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' }
  let res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password, name: 'Vault E2E' }),
  })
  if (!res.ok) throw new Error('signup failed: ' + (await res.text()).slice(0, 200))
  const created = (await res.json()) as { user: { id: string } }
  const userId = created.user.id

  // Mark verified (middleware requires it in Postgres mode).
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))

  res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('signin failed: ' + (await res.text()).slice(0, 200))
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/)
  if (!match) throw new Error('no session cookie: ' + setCookie.slice(0, 200))
  const cookie = `better-auth.session_token=${match[1]}`
  const req = (path: string, init?: RequestInit) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init?.headers ?? {}) },
    })

  try {
    // Build a real envelope client-side (server must never see these keys).
    const params = createVaultParams()
    const dek = generateDek()
    const kek = await deriveKek('e2e-test-password-123', params)
    const snapshot = {
      transactions: [
        {
          id: randomUUID(), accountId: randomUUID(), statementId: null, date: '2026-09-05',
          description: 'SWIGGY', merchant: null, amount: '500.00', type: 'debit',
          isOneTime: false, categoryId: null, comment: null, dedupHash: 'x',
        },
      ],
      categories: [], statements: [], owners: [], updatedAt: new Date().toISOString(),
    }
    const env = encryptSnapshot(snapshot, dek)
    const payload = {
      cipher: env.cipherB64,
      nonce: env.nonceB64,
      salt: params.saltB64,
      opslimit: params.iterations,
      memlimit: params.memorySize,
      wrappedDekPassword: wrapDek(dek, kek),
      wrappedDekRecovery: null,
      version: 1,
    }

    let res = await req('/v1/vault', { method: 'PUT', body: JSON.stringify(payload) })
    console.log('PUT status:', res.status)
    if (res.status !== 200) throw new Error('PUT failed: ' + (await res.text()).slice(0, 200))

    res = await req('/v1/vault')
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    console.log('GET status:', res.status)
    const match =
      body.data['cipher'] === payload.cipher &&
      body.data['nonce'] === payload.nonce &&
      body.data['salt'] === payload.salt &&
      body.data['wrappedDekPassword'] === payload.wrappedDekPassword
    console.log('opaque round-trip match:', match)
    if (!match) throw new Error('Blob mismatch')

    // Client-side decrypt of what the server returned (proves E2E).
    const dekBack = await unwrapDek(body.data['wrappedDekPassword'] as string, kek)
    const snapBack = await decryptSnapshot(body.data['cipher'] as string, body.data['nonce'] as string, dekBack)
    console.log('client decrypt txns:', (snapBack.transactions as unknown[]).length)

    // Per-device wraps: register two fake-device wraps (PRF output simulated
    // by random 32B — proves store mechanics; real PRF needs a browser).
    const fakePrf1 = randomBytes(32)
    const fakePrf2 = randomBytes(32)
    const postWrap = async (credentialId: string, prf: Uint8Array, label: string) => {
      const r = await req('/v1/vault/wraps', {
        method: 'POST',
        body: JSON.stringify({ credentialId, wrappedDek: wrapDek(dekBack, prf), label }),
      })
      if (r.status !== 201) throw new Error('wrap register failed: ' + (await r.text()).slice(0, 200))
    }
    await postWrap('cred-device-a', fakePrf1, 'Test MacBook')
    await postWrap('cred-device-b', fakePrf2, 'Test Pixel')

    res = await req('/v1/vault')
    const withWraps = (await res.json()) as {
      success: boolean
      data: { wraps: Array<{ credentialId: string; label: string; wrappedDek: string }> }
    }
    console.log('wraps listed:', withWraps.data.wraps.length)
    if (withWraps.data.wraps.length !== 2) throw new Error('Wraps not listed')
    // Each device unwraps with its own PRF output; cross-unwrap must fail.
    const w1 = withWraps.data.wraps.find((w) => w.credentialId === 'cred-device-a')!
    const d1 = await unwrapDek(w1.wrappedDek, fakePrf1)
    if (Buffer.from(d1).toString('hex') !== Buffer.from(dekBack).toString('hex')) throw new Error('Wrap 1 mismatch')
    try {
      await unwrapDek(w1.wrappedDek, fakePrf2)
      throw new Error('cross-unwrap accepted')
    } catch (e) {
      if ((e as Error).message === 'cross-unwrap accepted') throw e
    }
    console.log('per-device wraps ok, cross-unwrap rejected: true')

    // Revoke one device; the other keeps working.
    res = await req('/v1/vault/wraps/cred-device-b', { method: 'DELETE' })
    if (res.status !== 200) throw new Error('Revoke failed')
    res = await req('/v1/vault')
    const afterRevoke = (await res.json()) as { success: boolean; data: { wraps: unknown[] } }
    if (afterRevoke.data.wraps.length !== 1) throw new Error('Revoke did not remove wrap')
    console.log('revoke ok, remaining wraps: 1')

    // Encrypted sync: same DEK, new snapshot bytes, version-guarded.
    const env2 = encryptSnapshot({ ...snapshot, updatedAt: 'v2' }, dekBack)
    res = await req('/v1/vault/sync', {
      method: 'POST',
      body: JSON.stringify({ cipher: env2.cipherB64, nonce: env2.nonceB64, baseVersion: 1 }),
    })
    const synced = (await res.json()) as { success: boolean; data: { version: number } }
    console.log('SYNC status:', res.status, 'version:', synced.data?.version)
    if (res.status !== 200 || synced.data?.version !== 2) throw new Error('Sync failed')

    res = await req('/v1/vault')
    const body2 = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    if (body2.data['cipher'] !== env2.cipherB64) throw new Error('Sync bytes not stored')
    console.log('sync bytes stored: true')

    // Stale baseVersion must conflict, never overwrite.
    res = await req('/v1/vault/sync', {
      method: 'POST',
      body: JSON.stringify({ cipher: env.cipherB64, nonce: env.nonceB64, baseVersion: 1 }),
    })
    const conflict = (await res.json()) as { success: boolean; error?: { code?: string } }
    console.log('stale sync:', res.status, conflict.error?.code)
    if (res.status !== 409 || conflict.error?.code !== 'CONFLICT') throw new Error('Conflict not detected')
    res = await req('/v1/vault')
    const body3 = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    if (body3.data['cipher'] !== env2.cipherB64) throw new Error('Stale write overwrote vault')
    console.log('stale write rejected, vault intact: true')

    // Cross-account restore: export A's blob, fresh account B restores it,
    // unlocks with A's password, and reads A's data. Proves portability.
    res = await req('/v1/vault')
    const backup = (await res.json()) as {
      success: boolean
      data: {
        cipher: string
        nonce: string
        salt: string
        opslimit: number
        memlimit: number
        wrappedDekPassword: string | null
        wrappedDekRecovery: string | null
        version: number
        wraps: Array<{ credentialId: string; wrappedDek: string; label: string }>
      }
    }
    const emailB = `vault-e2e-b-${Date.now()}@example.com`
    let resB = await fetch(`${BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: emailB, password, name: 'Vault E2E B' }),
    })
    if (!resB.ok) throw new Error('signup B failed')
    const createdB = (await resB.json()) as { user: { id: string } }
    const userIdB = createdB.user.id
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userIdB))
    resB = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: emailB, password }),
    })
    if (!resB.ok) throw new Error('signin B failed')
    const matchB = (resB.headers.get('set-cookie') ?? '').match(/better-auth\.session_token=([^;]+)/)
    if (!matchB) throw new Error('no session cookie B')
    const reqB = (path: string, init?: RequestInit) =>
      fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Cookie: `better-auth.session_token=${matchB[1]}`,
          ...(init?.headers ?? {}),
        },
      })
    // Restore = PUT blob fields + re-register wraps (mirrors restoreVaultFromFile).
    resB = await reqB('/v1/vault', {
      method: 'PUT',
      body: JSON.stringify({
        cipher: backup.data.cipher,
        nonce: backup.data.nonce,
        salt: backup.data.salt,
        opslimit: backup.data.opslimit,
        memlimit: backup.data.memlimit,
        wrappedDekPassword: backup.data.wrappedDekPassword,
        wrappedDekRecovery: backup.data.wrappedDekRecovery,
        version: 1,
      }),
    })
    if (resB.status !== 200) throw new Error('restore PUT failed: ' + (await resB.text()).slice(0, 200))
    for (const w of backup.data.wraps) {
      resB = await reqB('/v1/vault/wraps', {
        method: 'POST',
        body: JSON.stringify({ credentialId: w.credentialId, wrappedDek: w.wrappedDek, label: w.label }),
      })
      if (resB.status !== 201) throw new Error('restore wrap failed')
    }
    resB = await reqB('/v1/vault')
    const bodyB = (await resB.json()) as {
      success: boolean
      data: { cipher: string; nonce: string; wrappedDekPassword: string; wraps: unknown[] }
    }
    const kekB = await deriveKek('e2e-test-password-123', {
      saltB64: backup.data.salt,
      iterations: backup.data.opslimit,
      memorySize: backup.data.memlimit,
    })
    const dekB = await unwrapDek(bodyB.data.wrappedDekPassword, kekB)
    const snapB = await decryptSnapshot(bodyB.data.cipher, bodyB.data.nonce, dekB)
    console.log(
      'cross-account restore ok:',
      (snapB.transactions as unknown[]).length === 1,
      'wraps:',
      (bodyB.data.wraps as unknown[]).length
    )
    if ((snapB.transactions as unknown[]).length !== 1) throw new Error('Restored data mismatch')
    // Cleanup B.
    await reqB('/v1/vault', { method: 'DELETE' })
    await db.delete(users).where(eq(users.id, userIdB))

    res = await req('/v1/vault', { method: 'DELETE' })
    console.log('DELETE status:', res.status)
    res = await req('/v1/vault')
    const gone = (await res.json()) as { success: boolean; error?: { code?: string } }
    console.log('GET after delete:', res.status, gone.error?.code)
    if (res.status !== 404 || gone.error?.code !== 'NO_VAULT') throw new Error('Delete did not clear vault')

    // Retirement validation: unconfirmed and vault-less deletes must fail;
    // an empty delete succeeds with zero counts (endpoint mechanics).
    res = await req('/v1/vault/user-data', { method: 'DELETE', body: JSON.stringify({}) })
    console.log('retire unconfirmed:', res.status)
    if (res.status !== 400) throw new Error('Unconfirmed retirement accepted')
    res = await req('/v1/vault/user-data', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) })
    const noVault = (await res.json()) as { success: boolean; error?: { code?: string } }
    console.log('retire without vault:', res.status, noVault.error?.code)
    if (res.status !== 400 || noVault.error?.code !== 'NO_VAULT') throw new Error('Vault-less retirement accepted')
    console.log('E2E PASS')
  } finally {
    await db.delete(vaultBlobs).where(eq(vaultBlobs.userId, userId))
    await db.delete(users).where(eq(users.id, userId))
    console.log('cleaned up test user')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('E2E FAIL:', e)
    process.exit(1)
  })

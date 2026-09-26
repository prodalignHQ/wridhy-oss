// E2E: opaque vault store round-trip against momoney_db_secure.
// 1. Seeds a verified user + session directly in the new DB.
// 2. Builds a REAL encrypted envelope with @momoney/local-engine crypto.
// 3. PUT → GET (byte-compare) → DELETE → GET (NO_VAULT).
// 4. Cleans up the test user.
import 'dotenv/config'
import { randomUUID } from 'crypto'
import { db, users, vaultBlobs } from '@momoney/db'
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
      wrappedDekPrf: null,
      prfCredentialId: null,
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

    res = await req('/v1/vault', { method: 'DELETE' })
    console.log('DELETE status:', res.status)
    res = await req('/v1/vault')
    const gone = (await res.json()) as { success: boolean; error?: { code?: string } }
    console.log('GET after delete:', res.status, gone.error?.code)
    if (res.status !== 404 || gone.error?.code !== 'NO_VAULT') throw new Error('Delete did not clear vault')
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

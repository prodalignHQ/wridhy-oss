import { Hono } from 'hono'
import { db } from '@momoney/db'
import { vaultBlobs, vaultWraps } from '@momoney/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth.js'

// ─── Opaque encrypted-vault store ────────────────────────────────────────────
// The server NEVER decrypts: `cipher` is XChaCha20-Poly1305 under a
// client-held DEK. All key-wrap fields are opaque base64 to the API.
// Per-device passkey wraps live in `vault_wraps` (PRF output is device-bound,
// so one row per credential). See packages/local-engine/src/crypto.ts.

export const vaultRoute = new Hono<{
  Variables: { userId: string }
}>()

vaultRoute.use('*', authMiddleware)

const base64 = z.string().regex(/^[A-Za-z0-9+/=_-]*$/, 'Expected base64')

const putVaultSchema = z.object({
  cipher: base64.max(20_000_000),
  nonce: base64.max(64),
  salt: base64.max(64),
  opslimit: z.number().int().positive(),
  memlimit: z.number().int().positive(),
  wrappedDekPassword: base64.max(512).nullable().optional(),
  wrappedDekRecovery: base64.max(512).nullable().optional(),
  version: z.number().int().positive().default(1),
})

const postWrapSchema = z.object({
  credentialId: z.string().min(8).max(512),
  wrappedDek: base64.max(512),
  label: z.string().min(1).max(100).default('Passkey'),
})

const syncVaultSchema = z.object({
  cipher: base64.max(20_000_000),
  nonce: base64.max(64),
  /** The blob version this snapshot was based on (optimistic concurrency). */
  baseVersion: z.number().int().positive(),
})

// ─── GET /v1/vault ──────────────────────────────────────────────────────────

vaultRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const [blob, wraps] = await Promise.all([
    db.query.vaultBlobs.findFirst({
      where: eq(vaultBlobs.userId, userId),
    }),
    db.query.vaultWraps.findMany({
      where: eq(vaultWraps.userId, userId),
      columns: { credentialId: true, wrappedDek: true, label: true, createdAt: true },
    }),
  ])

  if (!blob) {
    return c.json(
      { success: false, error: { code: 'NO_VAULT', message: 'No vault found for this user' } },
      404
    )
  }

  return c.json({ success: true, data: { ...blob, wraps } })
})

// ─── PUT /v1/vault ──────────────────────────────────────────────────────────

vaultRoute.put('/', zValidator('json', putVaultSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const [saved] = await db
    .insert(vaultBlobs)
    .values({
      userId,
      cipher: body.cipher,
      nonce: body.nonce,
      salt: body.salt,
      opslimit: body.opslimit,
      memlimit: body.memlimit,
      wrappedDekPassword: body.wrappedDekPassword ?? null,
      wrappedDekRecovery: body.wrappedDekRecovery ?? null,
      version: body.version,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: vaultBlobs.userId,
      set: {
        cipher: body.cipher,
        nonce: body.nonce,
        salt: body.salt,
        opslimit: body.opslimit,
        memlimit: body.memlimit,
        wrappedDekPassword: body.wrappedDekPassword ?? null,
        wrappedDekRecovery: body.wrappedDekRecovery ?? null,
        version: body.version,
        updatedAt: new Date(),
      },
    })
    .returning({ updatedAt: vaultBlobs.updatedAt, version: vaultBlobs.version })

  return c.json({ success: true, data: saved })
})

// ─── POST /v1/vault/sync ──────────────────────────────────────────────────
// Encrypted backup: replaces ONLY the ciphertext envelope, guarded by
// optimistic concurrency. The client sends already-encrypted bytes; the
// server validates shape/size, checks baseVersion, and stores. It cannot
// parse, categorize, or otherwise read the content — there is no plaintext
// code path here by construction.

vaultRoute.post('/sync', zValidator('json', syncVaultSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const current = await db.query.vaultBlobs.findFirst({
    where: eq(vaultBlobs.userId, userId),
    columns: { version: true },
  })

  if (!current) {
    return c.json(
      { success: false, error: { code: 'NO_VAULT', message: 'Set up the vault before syncing' } },
      404
    )
  }

  if (current.version !== body.baseVersion) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Vault changed since this snapshot was based. Refresh and retry.',
        },
        currentVersion: current.version,
      },
      409
    )
  }

  const [saved] = await db
    .update(vaultBlobs)
    .set({
      cipher: body.cipher,
      nonce: body.nonce,
      version: current.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(vaultBlobs.userId, userId))
    .returning({ version: vaultBlobs.version, updatedAt: vaultBlobs.updatedAt })

  return c.json({ success: true, data: saved })
})

// ─── POST /v1/vault/wraps ─────────────────────────────────────────────────
// Register (or re-register) a per-device passkey wrap. Requires the vault to
// exist; the client only calls this while unlocked (it holds the DEK).

vaultRoute.post('/wraps', zValidator('json', postWrapSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const blob = await db.query.vaultBlobs.findFirst({
    where: eq(vaultBlobs.userId, userId),
    columns: { userId: true },
  })
  if (!blob) {
    return c.json(
      { success: false, error: { code: 'NO_VAULT', message: 'Set up the vault before adding a passkey' } },
      404
    )
  }

  const [saved] = await db
    .insert(vaultWraps)
    .values({
      userId,
      credentialId: body.credentialId,
      wrappedDek: body.wrappedDek,
      label: body.label,
    })
    .onConflictDoUpdate({
      target: [vaultWraps.userId, vaultWraps.credentialId],
      set: { wrappedDek: body.wrappedDek, label: body.label },
    })
    .returning({
      credentialId: vaultWraps.credentialId,
      label: vaultWraps.label,
      createdAt: vaultWraps.createdAt,
    })

  return c.json({ success: true, data: saved }, 201)
})

// ─── DELETE /v1/vault/wraps/:credentialId ──────────────────────────────────
// Revoke a device's unlock. Note: this removes future access; rotating the
// DEK afterwards (backlog) additionally invalidates exfiltrated wraps.

vaultRoute.delete('/wraps/:credentialId', async (c) => {
  const userId = c.get('userId')
  const credentialId = c.req.param('credentialId')

  const [deleted] = await db
    .delete(vaultWraps)
    .where(and(eq(vaultWraps.userId, userId), eq(vaultWraps.credentialId, credentialId)))
    .returning({ credentialId: vaultWraps.credentialId })

  if (!deleted) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Passkey not found' } },
      404
    )
  }

  return c.json({ success: true, data: null })
})

// ─── DELETE /v1/vault ───────────────────────────────────────────────────────

vaultRoute.delete('/', async (c) => {
  const userId = c.get('userId')

  await db.delete(vaultBlobs).where(eq(vaultBlobs.userId, userId))

  return c.json({ success: true, data: null })
})

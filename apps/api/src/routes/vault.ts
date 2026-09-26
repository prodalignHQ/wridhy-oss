import { Hono } from 'hono'
import { db } from '@momoney/db'
import { vaultBlobs } from '@momoney/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth.js'

// ─── Opaque encrypted-vault store ────────────────────────────────────────────
// The server NEVER decrypts: `cipher` is XChaCha20-Poly1305 under a
// client-held DEK. All key-wrap fields are opaque base64 to the API.
// See packages/local-engine/src/crypto.ts for the client envelope format.

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
  wrappedDekPrf: base64.max(512).nullable().optional(),
  prfCredentialId: z.string().max(512).nullable().optional(),
  wrappedDekRecovery: base64.max(512).nullable().optional(),
  version: z.number().int().positive().default(1),
})

// ─── GET /v1/vault ──────────────────────────────────────────────────────────

vaultRoute.get('/', async (c) => {
  const userId = c.get('userId')

  const blob = await db.query.vaultBlobs.findFirst({
    where: eq(vaultBlobs.userId, userId),
  })

  if (!blob) {
    return c.json(
      { success: false, error: { code: 'NO_VAULT', message: 'No vault found for this user' } },
      404
    )
  }

  return c.json({ success: true, data: blob })
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
      wrappedDekPrf: body.wrappedDekPrf ?? null,
      prfCredentialId: body.prfCredentialId ?? null,
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
        wrappedDekPrf: body.wrappedDekPrf ?? null,
        prfCredentialId: body.prfCredentialId ?? null,
        wrappedDekRecovery: body.wrappedDekRecovery ?? null,
        version: body.version,
        updatedAt: new Date(),
      },
    })
    .returning({ updatedAt: vaultBlobs.updatedAt, version: vaultBlobs.version })

  return c.json({ success: true, data: saved })
})

// ─── DELETE /v1/vault ───────────────────────────────────────────────────────

vaultRoute.delete('/', async (c) => {
  const userId = c.get('userId')

  await db.delete(vaultBlobs).where(eq(vaultBlobs.userId, userId))

  return c.json({ success: true, data: null })
})

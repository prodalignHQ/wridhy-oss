import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, isSqlite } from './index.js'
import * as schema from './schema.js'
import * as sqliteSchema from './schema.sqlite.js'
import { owners } from './schema.js'
import { sendEmail } from './email.js'

function getTrustedOrigins() {
  const configured = process.env['BETTER_AUTH_TRUSTED_ORIGINS'] ?? process.env['AUTH_TRUSTED_ORIGINS']
  const origins = configured
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins?.length) {
    return origins
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000']
}

export const auth = betterAuth({
  baseURL: process.env['BETTER_AUTH_URL'] ?? process.env['AUTH_BASE_URL'] ?? 'http://localhost:3001',
  trustedOrigins: getTrustedOrigins(),
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  database: drizzleAdapter(db, {
    provider: isSqlite ? 'sqlite' : 'pg',
    schema: isSqlite ? (sqliteSchema as any) : schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (isSqlite || process.env['MOMONEY_LOCAL_MODE'] === 'true') {
        console.log(`[Local Auth] Verification URL: ${url}`)
        return
      }
      try {
        await sendEmail({
          to: user.email,
          subject: 'Verify your MoMoney email',
          text: `Verify your email for MoMoney by visiting this link:\n\n${url}`,
          html: `<p>Verify your email for <strong>MoMoney</strong>.</p><p><a href="${url}">Verify email</a></p><p>${url}</p>`,
        })
      } catch (err) {
        console.warn('Failed to send verification email, continuing:', err)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(owners).values({
            userId: user.id,
            name: 'Self',
            color: 'indigo',
            isDefault: true,
          })
        },
      },
    },
  },
})

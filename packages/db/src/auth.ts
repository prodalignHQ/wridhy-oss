import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./index.js"
import { owners } from "./schema.js"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(owners).values({
            userId: user.id,
            name: "Self",
            type: "person",
            color: "indigo",
            isDefault: true,
          })
        },
      },
    },
  },
})

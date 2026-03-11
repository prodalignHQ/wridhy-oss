import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../../apps/api/.env' })

const dbType = process.env['DB_TYPE'] === 'sqlite' ? 'sqlite' : 'postgresql'

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: dbType,
  dbCredentials:
    dbType === 'postgresql'
      ? { url: process.env['DATABASE_URL'] ?? 'postgres://momoney:momoney_dev@localhost:5432/momoney_db' }
      : { url: process.env['SQLITE_URL'] ?? 'sqlite.db' },
  verbose: true,
  strict: true,
})

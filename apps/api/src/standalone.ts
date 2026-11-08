import './standalone-logger.js'
import './polyfill.js'
import { logFilePath, handleFatalCrash } from './standalone-logger.js'
import { createApiApp } from './app.js'
import { ensureLocalUserAndSeed } from '@momoney/db/local-seed'
import { isSqlite, rawPgSql } from '@momoney/db'
import { ensurePostgresInitAndSeed } from '@momoney/db/postgres-init'
import { embeddedAssets } from './embedded-assets.js'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const app = createApiApp()

// Pre-decode gzip buffers into memory for instant sub-millisecond serving
const assetCache = new Map<string, { mime: string; data: Uint8Array }>()
for (const [key, value] of Object.entries((embeddedAssets || {}) as Record<string, { mime: string; base64: string }>)) {
  assetCache.set(key, {
    mime: value.mime,
    data: Buffer.from(value.base64, 'base64'),
  })
}

// ─── Embedded Frontend Handler ───────────────────────────────────────────────

app.get('*', (c, next) => {
  const p = c.req.path

  // Skip API and health routes
  if (p.startsWith('/v1/') || p.startsWith('/api/') || p === '/health') {
    return next()
  }

  // 1. Exact match
  let asset = assetCache.get(p)

  // 2. Root path
  if (!asset && (p === '/' || p === '')) {
    asset = assetCache.get('/index.html')
  }

  // 3. Clean route match (e.g. /dashboard -> /dashboard.html)
  if (!asset && !p.includes('.')) {
    asset = assetCache.get(`${p}.html`) || assetCache.get(`${p}/index.html`)
  }

  // 4. SPA fallback (e.g. client-side router)
  if (!asset && !p.startsWith('/_next/')) {
    asset = assetCache.get('/index.html')
  }

  if (asset) {
    return c.body(asset.data as any, 200, {
      'Content-Type': asset.mime,
      'Content-Encoding': 'gzip',
      'Cache-Control': p.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
  }

  return next()
})

// Fallback 404
app.notFound((c) => {
  const notFoundHtml = assetCache.get('/404.html') || assetCache.get('/_not-found.html')
  if (notFoundHtml) {
    return c.body(notFoundHtml.data as any, 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'gzip',
    })
  }
  return c.text('Not Found', 404)
})

// ─── Helper: Open Browser ────────────────────────────────────────────────────

function openBrowser(url: string) {
  const platform = process.platform
  let cmd = 'open'
  let args = [url]

  if (platform === 'win32') {
    cmd = 'cmd.exe'
    args = ['/c', 'start', '""', url]
  } else if (platform === 'linux') {
    cmd = 'xdg-open'
    args = [url]
  }

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true })
    child.on('error', (err) => {
      console.warn(`[Browser Notice] Could not automatically open browser: ${err.message}. Please navigate manually to ${url}`)
    })
    child.unref()
  } catch (err: any) {
    console.warn(`[Browser Notice] Failed to launch browser process: ${err?.message || err}. Please navigate manually to ${url}`)
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n==================================================`)
  console.log(`  💰 MoMoney — Privacy-First Personal Finance`)
  console.log(`==================================================`)

  // Ensure DB and seed data
  if (isSqlite) {
    await ensureLocalUserAndSeed()
    const dbFile = process.env['SQLITE_DB_PATH'] || path.join(os.homedir(), '.momoney', 'momoney.db')
    console.log(`  📂 Database: SQLite (${dbFile})`)
  } else {
    if (rawPgSql) {
      await ensurePostgresInitAndSeed(rawPgSql)
    } else {
      await ensureLocalUserAndSeed()
    }
    const cleanDbUrl = process.env['DATABASE_URL']
      ? process.env['DATABASE_URL'].replace(/:[^:@]+@/, ':****@')
      : 'configured'
    console.log(`  📂 Database: PostgreSQL (${cleanDbUrl})`)
  }

  console.log(`  📝 Logs: ${logFilePath}`)

  const desiredPort = parseInt(process.env['PORT'] ?? '3000', 10)
  let port = desiredPort

  // Start with Bun.serve
  let server: any
  const bunRuntime = (globalThis as any).Bun
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      server = bunRuntime.serve({
        fetch: app.fetch,
        port,
      })
      break
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' || err.code === 'WSAEADDRINUSE' || String(err?.message).includes('already in use')) {
        port++
      } else {
        throw err
      }
    }
  }

  if (!server) {
    console.error('❌ Could not find an available port to bind server.')
    process.exit(1)
  }

  const url = `http://localhost:${server.port}`
  console.log(`  🚀 Running at: ${url}`)
  console.log(`==================================================`)
  console.log(`  Opening browser... Press Ctrl+C to stop.\n`)

  openBrowser(url)
}

main().catch((err) => {
  handleFatalCrash(err, 'Fatal startup error')
})

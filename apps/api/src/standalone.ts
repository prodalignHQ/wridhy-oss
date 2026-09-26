import './polyfill.js'
import { createApiApp } from './app.js'
import { ensureLocalUserAndSeed } from '@momoney/db/local-seed'
import { embeddedAssets } from './embedded-assets.js'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

// Force local mode and SQLite defaults when running as a standalone binary
process.env['MOMONEY_LOCAL_MODE'] = 'true'
process.env['DB_DIALECT'] = 'sqlite'
if (!process.env['BETTER_AUTH_SECRET']) {
  process.env['BETTER_AUTH_SECRET'] = 'momoney-local-secret-standalone-build-key'
}

const app = createApiApp()

// Pre-decode gzip buffers into memory for instant sub-millisecond serving
const assetCache = new Map<string, { mime: string; data: Uint8Array }>()
for (const [key, value] of Object.entries(embeddedAssets)) {
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
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.unref()
  } catch {
    // Ignore browser open failures (e.g. headless environment)
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n==================================================`)
  console.log(`  💰 MoMoney — Privacy-First Personal Finance`)
  console.log(`==================================================`)

  // Ensure DB and local user
  await ensureLocalUserAndSeed()
  const dbFile = process.env['SQLITE_DB_PATH'] || path.join(os.homedir(), '.momoney', 'momoney.db')
  console.log(`  📂 Database: ${dbFile}`)

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
      if (err.code === 'EADDRINUSE') {
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
  console.error('Fatal startup error:', err)
  process.exit(1)
})

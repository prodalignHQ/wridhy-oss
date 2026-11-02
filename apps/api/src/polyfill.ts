// Headless polyfills for pdf-parse / pdfjs-dist
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
  }
}
if (typeof (globalThis as any).Path2D === 'undefined') {
  ;(globalThis as any).Path2D = class Path2D {}
}
if (typeof (globalThis as any).ImageData === 'undefined') {
  ;(globalThis as any).ImageData = class ImageData {}
}

// Standalone binary defaults: dynamic PostgreSQL or SQLite detection
const dbUrl = process.env['DATABASE_URL']
const hasPostgres = Boolean(
  (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) ||
  process.env['DB_DIALECT'] === 'postgres' ||
  process.env['DB_DIALECT'] === 'postgresql'
)

if (hasPostgres) {
  process.env['DB_DIALECT'] = 'postgres'
} else if (!process.env['DB_DIALECT']) {
  process.env['DB_DIALECT'] = 'sqlite'
}

if (!process.env['MOMONEY_LOCAL_MODE']) {
  process.env['MOMONEY_LOCAL_MODE'] = hasPostgres ? 'false' : 'true'
}

if (!process.env['BETTER_AUTH_SECRET']) {
  process.env['BETTER_AUTH_SECRET'] = 'wridhy-standalone-secret-key'
}


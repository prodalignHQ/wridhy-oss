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

// Standalone binary defaults: enforce SQLite and local mode
process.env['DB_DIALECT'] = 'sqlite'
process.env['MOMONEY_LOCAL_MODE'] = 'true'
if (!process.env['BETTER_AUTH_SECRET']) {
  process.env['BETTER_AUTH_SECRET'] = 'momoney-local-secret-standalone-build-key'
}


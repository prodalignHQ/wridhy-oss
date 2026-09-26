// Polyfill headless canvas matrix for pdf-parse in Node / Bun
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
  }
}
if (typeof (globalThis as any).Path2D === 'undefined') {
  ;(globalThis as any).Path2D = class Path2D {}
}
if (typeof (globalThis as any).ImageData === 'undefined') {
  ;(globalThis as any).ImageData = class ImageData {}
}

export type { ParsedTransaction, BankParser } from './base.parser.js'
export { getParser, listParsers } from './parser-registry.js'
export { iciciSavingsParser } from './banks/icici-savings.parser.js'
export { iciciCreditParser } from './banks/icici-credit.parser.js'
export { hdfcSavingsParser } from './banks/hdfc-savings.parser.js'
export { hdfcCreditParser } from './banks/hdfc-credit.parser.js'


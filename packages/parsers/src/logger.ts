import createDebug from 'debug'

/**
 * Parser Debug Logging Utility
 *
 * Checks dynamically on each call so that variables loaded by dotenv or runtime flags
 * take effect immediately.
 *
 * Enabled by:
 *   - DEBUG=true, DEBUG=1, DEBUG=*, DEBUG=momoney:*, DEBUG=parsers*
 *   - PARSER_DEBUG=1, PARSER_DEBUG=true
 *   - LOG_LEVEL=debug, LOG_LEVEL=trace
 *   - Programmatic: setDebug(true)
 */

let forceDebug: boolean | null = null

export function setDebug(enabled: boolean | null): void {
  forceDebug = enabled
  if (enabled === true) {
    createDebug.enable('momoney:parsers:*')
  } else if (enabled === false) {
    createDebug.disable()
  }
}

export function isDebugEnabled(): boolean {
  if (forceDebug !== null) {
    return forceDebug
  }

  const env = typeof process !== 'undefined' && process?.env ? process.env : undefined
  if (!env) {
    return false
  }

  const parserDebug = env['PARSER_DEBUG']?.trim().toLowerCase()
  if (parserDebug === '1' || parserDebug === 'true') {
    return true
  }

  const logLevel = env['LOG_LEVEL']?.trim().toLowerCase()
  if (logLevel === 'debug' || logLevel === 'trace') {
    return true
  }

  const debug = env['DEBUG']
  if (debug) {
    const d = debug.trim().toLowerCase()
    if (d === '1' || d === 'true' || d === '*') {
      return true
    }
    const patterns = d.split(',').map((p) => p.trim())
    for (const pattern of patterns) {
      if (
        pattern === '*' ||
        pattern === 'parsers' ||
        pattern.startsWith('parsers') ||
        pattern.includes('parser') ||
        pattern.startsWith('momoney') ||
        pattern === '@momoney/parsers'
      ) {
        return true
      }
    }
  }

  const nodeDebug = env['NODE_DEBUG']?.trim().toLowerCase()
  if (nodeDebug && (nodeDebug === '*' || nodeDebug.includes('parser'))) {
    return true
  }

  return false
}

export interface ParserLogger {
  debug(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, error?: unknown, ...args: unknown[]): void
  isDebugEnabled(): boolean
}

export function createParserLogger(parserName: string): ParserLogger {
  const tag = `[Parsers:${parserName}]`
  const debugNamespace = `momoney:parsers:${parserName.replace(/_/g, '-')}`
  const debugInstance = createDebug(debugNamespace)

  return {
    debug(message: string, ...args: unknown[]) {
      if (isDebugEnabled()) {
        console.log(`${tag} ${message}`, ...args)
        if (debugInstance.enabled) {
          debugInstance(message, ...args)
        }
      }
    },
    warn(message: string, ...args: unknown[]) {
      if (isDebugEnabled()) {
        console.warn(`${tag}[WARN] ${message}`, ...args)
        if (debugInstance.enabled) {
          debugInstance(`[WARN] ${message}`, ...args)
        }
      }
    },
    error(message: string, error?: unknown, ...args: unknown[]) {
      if (isDebugEnabled()) {
        if (error !== undefined) {
          console.error(`${tag}[ERROR] ${message}`, error, ...args)
          if (debugInstance.enabled) {
            debugInstance(`[ERROR] ${message}`, error, ...args)
          }
        } else {
          console.error(`${tag}[ERROR] ${message}`, ...args)
        }
      }
    },
    isDebugEnabled,
  }
}

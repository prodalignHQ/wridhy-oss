import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import util from 'node:util'

export function getMomoneyDataDir(): string {
  let dbPath = process.env['SQLITE_DB_PATH']
  if (!dbPath) {
    const dbUrl = process.env['DATABASE_URL']
    if (dbUrl && dbUrl.startsWith('file:')) {
      dbPath = dbUrl.slice(5)
    } else if (dbUrl && (dbUrl.endsWith('.db') || dbUrl.endsWith('.sqlite'))) {
      dbPath = dbUrl
    } else {
      return path.join(os.homedir(), '.momoney')
    }
  }

  if (dbPath.startsWith('~')) {
    dbPath = path.join(os.homedir(), dbPath.slice(1))
  }

  return path.dirname(path.resolve(dbPath))
}

function getFormattedDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

const dataDir = getMomoneyDataDir()
export const logsDir = path.join(dataDir, 'logs')

// Ensure logs folder exists
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
} catch {
  // Ignore mkdir errors
}

// Clear old log files on every run
try {
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir)
    for (const file of files) {
      if (file.endsWith('.log')) {
        try {
          fs.unlinkSync(path.join(logsDir, file))
        } catch {
          // Ignore if locked or cannot be deleted
        }
      }
    }
  }
} catch {
  // Ignore directory read errors
}

const dateStr = getFormattedDate()
export const logFilePath = path.join(logsDir, `wridhy-${dateStr}.log`)

export function writeToLogFileSync(content: string) {
  try {
    fs.appendFileSync(logFilePath, stripAnsi(content), 'utf-8')
  } catch {
    // Disk write error fallback
  }
}

// Write initial diagnostic startup header
try {
  const nowIso = new Date().toISOString()
  const header = [
    '================================================================================',
    `  Wridhy / MoMoney Application Log — Started at ${nowIso}`,
    '================================================================================',
    `  Platform     : ${process.platform} (${process.arch}) - ${os.type()} ${os.release()}`,
    `  Runtime      : Node/Bun ${process.version} (Bun: ${(globalThis as any).Bun?.version ?? 'N/A'})`,
    `  Process ID   : ${process.pid}`,
    `  Executable   : ${process.execPath}`,
    `  Working Dir  : ${process.cwd()}`,
    `  Home Dir     : ${os.homedir()}`,
    `  Database Dir : ${dataDir}`,
    `  Logs Dir     : ${logsDir}`,
    `  Log File     : ${logFilePath}`,
    `  Arguments    : ${JSON.stringify(process.argv)}`,
    `  Environment  :`,
    `    PORT = ${process.env['PORT'] ?? '(default 3000)'}`,
    `    DB_DIALECT = ${process.env['DB_DIALECT'] ?? '(default sqlite)'}`,
    `    SQLITE_DB_PATH = ${process.env['SQLITE_DB_PATH'] ?? '(default ~/.momoney/momoney.db)'}`,
    `    DATABASE_URL = ${process.env['DATABASE_URL'] ? '(set)' : '(not set)'}`,
    `    MOMONEY_LOCAL_MODE = ${process.env['MOMONEY_LOCAL_MODE'] ?? '(not set)'}`,
    '================================================================================\n\n',
  ].join('\n')

  writeToLogFileSync(header)
} catch {
  // Ignore header write failure
}

// Preserve original console and stream write functions
const origLog = console.log.bind(console)
const origError = console.error.bind(console)
const origWarn = console.warn.bind(console)
const origInfo = console.info.bind(console)
const origDebug = console.debug.bind(console)
const origStdoutWrite = process.stdout.write.bind(process.stdout)
const origStderrWrite = process.stderr.write.bind(process.stderr)

let isIntercepting = false

function timestampPrefix(level: string): string {
  return `[${new Date().toISOString()}] [${level}] `
}

console.log = function (...args: any[]) {
  isIntercepting = true
  try {
    const formatted = util.format(...args)
    writeToLogFileSync(timestampPrefix('INFO') + formatted + '\n')
    origLog(...args)
  } finally {
    isIntercepting = false
  }
}

console.info = function (...args: any[]) {
  isIntercepting = true
  try {
    const formatted = util.format(...args)
    writeToLogFileSync(timestampPrefix('INFO') + formatted + '\n')
    origInfo(...args)
  } finally {
    isIntercepting = false
  }
}

console.warn = function (...args: any[]) {
  isIntercepting = true
  try {
    const formatted = util.format(...args)
    writeToLogFileSync(timestampPrefix('WARN') + formatted + '\n')
    origWarn(...args)
  } finally {
    isIntercepting = false
  }
}

console.error = function (...args: any[]) {
  isIntercepting = true
  try {
    const formatted = util.format(...args)
    writeToLogFileSync(timestampPrefix('ERROR') + formatted + '\n')
    origError(...args)
  } finally {
    isIntercepting = false
  }
}

console.debug = function (...args: any[]) {
  isIntercepting = true
  try {
    const formatted = util.format(...args)
    writeToLogFileSync(timestampPrefix('DEBUG') + formatted + '\n')
    origDebug(...args)
  } finally {
    isIntercepting = false
  }
}

process.stdout.write = function (chunk: any, ...args: any[]): boolean {
  if (!isIntercepting) {
    const text = typeof chunk === 'string' ? chunk : chunk?.toString() || ''
    writeToLogFileSync(text)
  }
  return (origStdoutWrite as any)(chunk, ...args)
}

process.stderr.write = function (chunk: any, ...args: any[]): boolean {
  if (!isIntercepting) {
    const text = typeof chunk === 'string' ? chunk : chunk?.toString() || ''
    writeToLogFileSync(text)
  }
  return (origStderrWrite as any)(chunk, ...args)
}

export function pauseForWindowsUser(message?: string) {
  if (process.platform === 'win32' && process.stdin.isTTY) {
    try {
      origError(message || `\nPress Enter to exit...`)
      const buf = Buffer.alloc(1)
      try {
        fs.readSync(0, buf, 0, 1, null)
      } catch {
        // Fallback wait 5 seconds if readSync cannot read
        const start = Date.now()
        while (Date.now() - start < 5000) {}
      }
    } catch {
      // Ignore
    }
  }
}

export function handleFatalCrash(err: any, context = 'Fatal error') {
  const errDetails = err instanceof Error ? (err.stack || err.message) : util.format(err)
  const banner = `\n==================================================\n❌ ${context}:\n${errDetails}\n\n📄 Detailed logs written to:\n  ${logFilePath}\n==================================================\n`
  writeToLogFileSync(banner)
  try {
    origError(banner)
  } catch {}
  pauseForWindowsUser()
  process.exit(1)
}

process.on('uncaughtException', (err, origin) => {
  handleFatalCrash(err, `Uncaught Exception (${origin})`)
})

process.on('unhandledRejection', (reason) => {
  handleFatalCrash(reason, 'Unhandled Promise Rejection')
})


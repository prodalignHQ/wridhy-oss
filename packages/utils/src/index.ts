import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Indian currency (INR).
 * e.g. 123456.78 → "₹1,23,456.78"
 */
export function formatINR(amount: number | string, showPaise = false): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₹0'

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  })
  return formatter.format(num)
}

/**
 * Format large INR amounts in abbreviated form.
 * e.g. 500000 → "₹5L", 10000000 → "₹1Cr"
 */
export function formatINRAbbr(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₹0'

  if (Math.abs(num) >= 10_000_000) {
    return `₹${(num / 10_000_000).toFixed(2)}Cr`
  }
  if (Math.abs(num) >= 100_000) {
    return `₹${(num / 100_000).toFixed(2)}L`
  }
  if (Math.abs(num) >= 1_000) {
    return `₹${(num / 1_000).toFixed(1)}K`
  }
  return formatINR(num)
}

/**
 * Simple string hash (djb2) — used for dedupHash in transactions.
 */
export function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) + hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

/**
 * Generate a dedup hash for a transaction.
 */
export function transactionDedupHash(
  accountId: string,
  date: Date,
  amount: string | number,
  description: string
): string {
  const normalized = `${accountId}|${date.toISOString().split('T')[0]}|${amount}|${hashString(description)}`
  return hashString(normalized)
}

/**
 * Auto-assign a color from the fixed palette based on owner name.
 */
export const OWNER_COLOR_PALETTE = [
  'indigo', 'emerald', 'rose', 'amber', 'sky', 'violet',
] as const

export type OwnerColor = (typeof OWNER_COLOR_PALETTE)[number]

export function assignOwnerColor(existingColors: string[], name: string): OwnerColor {
  // Try to assign based on name hash
  const idx = Math.abs(hashString(name).charCodeAt(0)) % OWNER_COLOR_PALETTE.length
  const preferred = OWNER_COLOR_PALETTE[idx]
  if (preferred && !existingColors.includes(preferred)) return preferred

  // Fall back to first unused color
  const unused = OWNER_COLOR_PALETTE.find(c => !existingColors.includes(c))
  return unused ?? 'indigo'
}

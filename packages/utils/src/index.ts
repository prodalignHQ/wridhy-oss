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

/**
 * Asset Classification Tags (Equity, Debt, Cash, Mixed)
 */
export type AssetTag = 'equity' | 'debt' | 'cash' | 'mixed'

export const ASSET_TAG_LABELS: Record<AssetTag, string> = {
  equity: 'Equity',
  debt: 'Debt',
  cash: 'Cash',
  mixed: 'Mixed',
}

export const ASSET_TAG_COLORS: Record<AssetTag, { badge: string; dot: string; text: string; bg: string; border: string }> = {
  equity: {
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-400',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500',
    border: 'border-indigo-500/30',
  },
  debt: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    border: 'border-amber-500/30',
  },
  cash: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    border: 'border-emerald-500/30',
  },
  mixed: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dot: 'bg-purple-400',
    text: 'text-purple-400',
    bg: 'bg-purple-500',
    border: 'border-purple-500/30',
  },
}

/**
 * Automatically resolve or fallback the asset classification tag.
 */
export function resolveAssetTag(
  type: string,
  metadata?: any,
  explicitTag?: string | null
): AssetTag {
  if (explicitTag && (explicitTag === 'equity' || explicitTag === 'debt' || explicitTag === 'cash' || explicitTag === 'mixed')) {
    return explicitTag as AssetTag
  }

  switch (type) {
    case 'stock':
      return 'equity'
    case 'mutual_fund': {
      const category = (metadata?.category || '').toLowerCase()
      if (category === 'debt') return 'debt'
      if (category === 'hybrid') return 'mixed'
      return 'equity'
    }
    case 'fixed_deposit':
    case 'recurring_deposit':
    case 'ppf':
      return 'debt'
    case 'savings_account':
    case 'cash':
      return 'cash'
    case 'crypto':
    case 'real_estate':
    case 'other':
    default:
      return 'equity'
  }
}


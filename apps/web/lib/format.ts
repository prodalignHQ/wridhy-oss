/**
 * Formats a number as Indian Rupee currency string
 * e.g. 123456 → ₹1,23,456
 */
export function formatINR(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Formats value in shorthand lakhs / crores for chart axes
 * e.g. 100000 → ₹1L, 10000000 → ₹1Cr
 */
export function formatINRShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(0)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

import { cn } from "@/lib/utils"

interface AmountBadgeProps {
  amount: string | number
  type?: "debit" | "credit"
  className?: string
}

/**
 * Inline pill showing an amount colored red (debit) or green (credit).
 * Always right-aligned with monospace font.
 */
export function AmountBadge({ amount, type, className }: AmountBadgeProps) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  const isDebit = type === "debit" || (!type && num < 0)

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(num))

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium tabular-nums",
        isDebit
          ? "bg-rose-500/10 text-rose-400"
          : "bg-emerald-500/10 text-emerald-400",
        className
      )}
    >
      {isDebit ? "−" : "+"} {formatted}
    </span>
  )
}

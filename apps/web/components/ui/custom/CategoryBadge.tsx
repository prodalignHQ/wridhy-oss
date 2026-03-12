import { cn } from "@/lib/utils"

interface CategoryBadgeProps {
  name: string
  color?: string
  className?: string
}

/**
 * Pill with a colored dot and the category name.
 * Used in transaction rows and category lists.
 */
export function CategoryBadge({ name, color = "#6366f1", className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700",
        className
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  )
}

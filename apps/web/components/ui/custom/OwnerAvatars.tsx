import { UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-primary", text: "text-indigo-50" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-50" },
  rose: { bg: "bg-rose-500", text: "text-rose-50" },
  amber: { bg: "bg-amber-500", text: "text-amber-50" },
  sky: { bg: "bg-sky-500", text: "text-sky-50" },
  violet: { bg: "bg-violet-500", text: "text-violet-50" },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface OwnerAvatarProps {
  name: string
  color?: string
  size?: "sm" | "md"
}

function OwnerAvatar({ name, color = "indigo", size = "sm" }: OwnerAvatarProps) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.indigo!
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"

  return (
    <div
      title={name}
      className={cn(
        "rounded-full flex items-center justify-center font-semibold flex-shrink-0 ring-2 ring-zinc-900",
        colors.bg,
        colors.text,
        sizeClass
      )}
    >
      {getInitials(name)}
    </div>
  )
}

interface OwnerAvatarsProps {
  owners: Array<{ name: string; color?: string }>
  max?: number
  size?: "sm" | "md"
  className?: string
}

/**
 * Stacked set of small colored initials-circles representing assigned owners.
 * Used in every transaction row.
 */
export function OwnerAvatars({
  owners,
  max = 3,
  size = "sm",
  className,
}: OwnerAvatarsProps) {
  if (owners.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors", className)}>
        <div className={cn(
          "rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center",
          size === "sm" ? "w-6 h-6" : "w-8 h-8"
        )}>
          <UserPlus size={size === "sm" ? 12 : 14} />
        </div>
        <span className={cn(
          "font-medium",
          size === "sm" ? "text-[11px]" : "text-xs"
        )}>
          Unassigned
        </span>
      </div>
    )
  }

  const visible = owners.slice(0, max)
  const overflow = owners.length - max

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((owner, i) => (
        <div key={i} className={i > 0 ? "-ml-1.5" : ""}>
          <OwnerAvatar name={owner.name} color={owner.color} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "-ml-1.5 rounded-full bg-card ring-2 ring-zinc-900 flex items-center justify-center font-semibold text-zinc-300",
            size === "sm" ? "w-6 h-6 text-[9px]" : "w-8 h-8 text-xs"
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

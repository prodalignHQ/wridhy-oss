import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  subLabel?: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  valueColor?: "default" | "green" | "red" | "amber"
  icon?: React.ReactNode
}

export function StatCard({
  label,
  value,
  subLabel,
  trend,
  trendValue,
  valueColor = "default",
  icon,
}: StatCardProps) {
  const valueColorClass = {
    default: "text-zinc-50",
    green: "text-emerald-400",
    red: "text-rose-400",
    amber: "text-amber-400",
  }[valueColor]

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>

      <p className={cn("text-3xl font-bold font-mono tabular-nums", valueColorClass)}>
        {value}
      </p>

      <div className="flex items-center gap-2 min-h-[20px]">
        {trend && trendValue && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-rose-400",
              trend === "neutral" && "text-zinc-500"
            )}
          >
            {trend === "up" && <TrendingUp size={12} />}
            {trend === "down" && <TrendingDown size={12} />}
            {trend === "neutral" && <Minus size={12} />}
            {trendValue}
          </span>
        )}
        {subLabel && (
          <span className="text-xs text-zinc-500">{subLabel}</span>
        )}
      </div>
    </div>
  )
}

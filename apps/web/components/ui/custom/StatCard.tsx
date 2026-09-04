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
    default: "text-foreground",
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-rose-600 dark:text-rose-400",
    amber: "text-amber-600 dark:text-amber-400",
  }[valueColor]

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </div>

      <p className={cn("text-3xl font-bold font-mono tabular-nums", valueColorClass)}>
        {value}
      </p>

      <div className="flex items-center gap-2 min-h-[20px]">
        {trend && trendValue && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === "up" && "text-emerald-600 dark:text-emerald-400",
              trend === "down" && "text-rose-600 dark:text-rose-400",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp size={12} />}
            {trend === "down" && <TrendingDown size={12} />}
            {trend === "neutral" && <Minus size={12} />}
            {trendValue}
          </span>
        )}
        {subLabel && (
          <span className="text-xs text-muted-foreground">{subLabel}</span>
        )}
      </div>
    </div>
  )
}

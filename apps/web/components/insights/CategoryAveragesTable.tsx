'use client'

import { CategoryAverage } from '@momoney/types'
import { cn } from '@/lib/utils'

interface CategoryAveragesTableProps {
  data: CategoryAverage
}

const formatINR = (value: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(String(value)))

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

export function CategoryAveragesTable({ data }: CategoryAveragesTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
        No average data available
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Avg. (12 mo)</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Current</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {(data as any[]).map((item: any) => {
            const current = parseFloat(item.currentAmount)
            const avg = parseFloat(item.avgAmount)
            const ratio = avg > 0 ? current / avg : 0
            
            let statusLabel = "On Track"
            let statusColor = "text-emerald-400 bg-emerald-500/10"
            
            if (ratio > 1.2) {
              statusLabel = "High"
              statusColor = "text-rose-400 bg-rose-500/10"
            } else if (ratio > 1.0) {
              statusLabel = "Above Avg"
              statusColor = "text-amber-400 bg-amber-500/10"
            } else if (ratio < 0.8 && ratio > 0) {
              statusLabel = "Below Avg"
              statusColor = "text-sky-400 bg-sky-500/10"
            }

            return (
              <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                <td className="py-4 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", COLOR_MAP[item.color || ''] || 'bg-zinc-500')} />
                    <span className="text-sm font-medium text-foreground group-hover:text-indigo-400 transition-colors">
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right tabular-nums text-sm text-muted-foreground">
                  {formatINR(item.avgAmount)}
                </td>
                <td className="py-4 px-4 text-right tabular-nums text-sm font-semibold">
                  {formatINR(item.currentAmount)}
                </td>
                <td className="py-4 px-4 text-right whitespace-nowrap">
                  <span className={cn(
                    "inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-tighter",
                    statusColor
                  )}>
                    {statusLabel}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

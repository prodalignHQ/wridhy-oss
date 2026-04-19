'use client'

import { CategoryComparison } from '@momoney/types'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryComparisonTableProps {
  data: CategoryComparison
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

export function CategoryComparisonTable({ data }: CategoryComparisonTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
        No comparison data for this period
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Selected Month</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Last Month</th>
            <th className="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {(data as any[]).map((item: any) => {
            const diff = parseFloat(item.diff)
            const isIncrease = diff > 0
            const isNoChange = diff === 0

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
                <td className="py-4 px-4 text-right tabular-nums text-sm font-semibold">
                  {formatINR(item.currentAmount)}
                </td>
                <td className="py-4 px-4 text-right tabular-nums text-sm text-muted-foreground">
                  {formatINR(item.prevAmount)}
                </td>
                <td className="py-4 px-4 text-right whitespace-nowrap">
                  <div className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    isIncrease ? "text-rose-400 bg-rose-500/10" : 
                    isNoChange ? "text-muted-foreground bg-muted" : 
                    "text-emerald-400 bg-emerald-500/10"
                  )}>
                    {isIncrease ? <ArrowUpRight size={12} /> : 
                     isNoChange ? <Minus size={12} /> : 
                     <ArrowDownRight size={12} />}
                    <span>
                      {isNoChange ? '0%' : `${Math.abs(item.diffPercentage).toFixed(1)}%`}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

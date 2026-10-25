'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { formatINR, formatINRShort } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface IncomeChartRecord {
  id: string
  financialYear: string
  grossIncomeNumber: number
  netIncomeNumber: number
  taxPaidNumber: number
  effectiveTaxRate: number
  yoyGrowthPercentage: number | null
  breakdown?: {
    salary?: number
    bonus?: number
    business?: number
    investments?: number
    rental?: number
    freelance?: number
    other?: number
  } | null
}

interface IncomeGrowthChartProps {
  records: IncomeChartRecord[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[200px]">
      <p className="font-semibold text-foreground border-b border-border/60 pb-1 mb-1">{label}</p>
      {payload.map((entry: any) => {
        const isPercent = entry.name.includes('%') || entry.name.includes('Rate')
        const formattedVal = isPercent
          ? `${Number(entry.value).toFixed(1)}%`
          : formatINR(entry.value)
        return (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-mono font-medium text-foreground">{formattedVal}</span>
          </div>
        )
      })}
    </div>
  )
}

export function IncomeGrowthChart({ records }: IncomeGrowthChartProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'breakdown'>('overview')

  const chartData = useMemo(() => {
    return records.map((r) => ({
      name: r.financialYear,
      'Gross Income': r.grossIncomeNumber,
      'Net Income': r.netIncomeNumber,
      'Tax Paid': r.taxPaidNumber,
      'YoY Growth %': r.yoyGrowthPercentage !== null ? Math.round(r.yoyGrowthPercentage * 10) / 10 : null,
      Salary: r.breakdown?.salary || 0,
      Bonus: r.breakdown?.bonus || 0,
      Business: r.breakdown?.business || 0,
      Investments: r.breakdown?.investments || 0,
      Rental: r.breakdown?.rental || 0,
      Freelance: r.breakdown?.freelance || 0,
      Other: r.breakdown?.other || 0,
    }))
  }, [records])

  if (!records || records.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/40">
        <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No financial year records to visualize yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Income Growth Trajectory</h3>
          <p className="text-xs text-muted-foreground">
            Financial Year earnings progression with YoY trends and tax deductions
          </p>
        </div>

        <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/40 self-start sm:self-auto">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 px-3 text-xs rounded-md',
              viewMode === 'overview' && 'bg-background shadow-xs text-foreground font-medium'
            )}
            onClick={() => setViewMode('overview')}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Gross vs Net vs Tax
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 px-3 text-xs rounded-md',
              viewMode === 'breakdown' && 'bg-background shadow-xs text-foreground font-medium'
            )}
            onClick={() => setViewMode('breakdown')}
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Source Breakdown
          </Button>
        </div>
      </div>

      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'overview' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="name"
                tickLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                dy={6}
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(val) => formatINRShort(val)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                stroke="#10b981"
                fontSize={11}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="Gross Income"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                yAxisId="left"
                dataKey="Net Income"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                yAxisId="left"
                dataKey="Tax Paid"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
                opacity={0.85}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="YoY Growth %"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="name"
                tickLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(val) => formatINRShort(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="Salary" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Bonus" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Business" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Investments" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Rental" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Freelance" stackId="a" fill="#ec4899" radius={[0, 0, 0, 0]} maxBarSize={45} />
              <Bar dataKey="Other" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={45} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

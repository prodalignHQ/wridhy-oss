'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatINR, formatINRShort } from '@/lib/format'
import { Briefcase } from 'lucide-react'

export interface SalaryTimelineEvent {
  revisionId: string
  sourceId: string
  companyName: string
  role: string
  ownerName?: string
  effectiveDate: string
  annualCtc: number
  baseSalary: number
  monthlyInHand: number
  variablePay: number
  stockGrant: number
  hikePercentage: number | null
  hikeType: string
  designation?: string
  cumulativeGrowth: number
  hikeXirr?: number | null
  cumulativeXirr?: number | null
  isFinalHike?: boolean
  notes?: string | null
}

interface SalaryTimelineChartProps {
  timeline: SalaryTimelineEvent[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const event = payload[0]?.payload as SalaryTimelineEvent | undefined

  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[240px]">
      <div className="border-b border-border/60 pb-1.5 mb-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">{event?.companyName}</p>
          {event?.isFinalHike && (
            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded">
              Final Hike
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{event?.designation || event?.role}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Effective: {label}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Annual CTC:</span>
        <span className="font-mono font-semibold text-primary">{formatINR(event?.annualCtc || 0)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Monthly In-Hand:</span>
        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
          {formatINR(event?.monthlyInHand || 0)}
        </span>
      </div>

      {event?.hikePercentage !== null && event?.hikePercentage !== undefined && (
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <span className="text-muted-foreground">Hike Received:</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            +{event.hikePercentage.toFixed(1)}% ({event.hikeType.replace('_', ' ')})
          </span>
        </div>
      )}

      {event?.hikeXirr !== null && event?.hikeXirr !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Hike XIRR (p.a.):</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {event.hikeXirr >= 0 ? '+' : ''}{event.hikeXirr.toFixed(1)}%
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <span className="text-muted-foreground">Cumulative Growth:</span>
        <span className="font-semibold text-indigo-500">+{event?.cumulativeGrowth || 0}%</span>
      </div>

      {event?.cumulativeXirr !== null && event?.cumulativeXirr !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Career XIRR (p.a.):</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {event.cumulativeXirr >= 0 ? '+' : ''}{event.cumulativeXirr.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

export function SalaryTimelineChart({ timeline }: SalaryTimelineChartProps) {
  const chartData = useMemo(() => {
    return timeline.map((item) => ({
      ...item,
      dateLabel: item.effectiveDate,
      'Annual CTC': item.annualCtc,
      'Monthly In-Hand (x12)': item.monthlyInHand * 12,
      'Cumulative Growth %': item.cumulativeGrowth,
    }))
  }, [timeline])

  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/40">
        <Briefcase className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No salary revisions to chart yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">Compensation Evolution & Hikes</h3>
          <p className="text-xs text-muted-foreground">
            Timeline of compensation adjustments, mid-year hikes, and promotion increments
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="ctcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
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
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="Annual CTC"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#ctcGradient)"
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Cumulative Growth %"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#10b981' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

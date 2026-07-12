'use client'

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import { formatINRShort } from '@/lib/format'

interface Snapshot {
  id: string
  snapshotDate: string | Date
  totalAssets: string | number
  totalLiabilities: string | number
  netWorth: string | number
  ownerId?: string | null
  owner?: {
    id: string
    name: string
    color: string
  } | null
}

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

interface NetWorthHistoryChartProps {
  snapshots: Snapshot[]
  owners: Owner[]
  selectedOwnerId: string
}


const colorHexMap: Record<string, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-muted border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-muted-foreground text-xs mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-foreground/80">{entry.name}:</span>
          <span className="font-mono font-semibold text-foreground">
            {formatINRShort(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function NetWorthHistoryChart({ snapshots, owners, selectedOwnerId }: NetWorthHistoryChartProps) {
  const defaultOwnerId = owners.find((o) => o.isDefault)?.id

  let chartData: any[] = []
  if (selectedOwnerId === 'all') {
    // Group snapshots by date
    const groupedByDate: Record<string, Snapshot[]> = {}
    for (const s of snapshots) {
      const dateKey = format(new Date(s.snapshotDate), 'yyyy-MM-dd')
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push(s)
    }

    const sortedDateKeys = Object.keys(groupedByDate).sort()

    // Keep track of the last known net worth for each owner
    const lastKnownNetWorth: Record<string, number> = {}
    for (const o of owners) {
      lastKnownNetWorth[o.id] = 0
    }

    chartData = sortedDateKeys.map((dateKey) => {
      const snapshotsForDate = groupedByDate[dateKey]
      
      // Update last known net worth with snapshots from this date
      for (const s of snapshotsForDate) {
        const oId = s.ownerId || defaultOwnerId || 'default'
        lastKnownNetWorth[oId] = parseFloat(s.netWorth as string)
      }

      const dateLabel = format(new Date(dateKey), 'dd MMM')
      const dataPoint: any = {
        dateLabel,
      }

      let totalNetWorth = 0
      for (const o of owners) {
        const val = lastKnownNetWorth[o.id]
        dataPoint[o.name] = val
        totalNetWorth += val
      }
      dataPoint['Total Net Worth'] = totalNetWorth
      return dataPoint
    })
  } else {
    chartData = snapshots.map((s) => ({
      dateLabel: format(new Date(s.snapshotDate), 'dd MMM'),
      Assets: parseFloat(s.totalAssets as string),
      Liabilities: parseFloat(s.totalLiabilities as string),
      'Net Worth': parseFloat(s.netWorth as string),
    }))
  }

  if (chartData.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        {/* Ghost chart SVG */}
        <svg
          width="280"
          height="100"
          viewBox="0 0 280 100"
          className="opacity-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline
            points="0,80 40,60 80,45 120,55 160,30 200,20 240,25 280,10"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="0,90 40,85 80,80 120,82 160,75 200,70 240,72 280,68"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <p className="text-muted-foreground font-medium">Not enough data to show a trend</p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Save at least 2 snapshots to see your net worth over time
          </p>
        </div>
      </div>
    )
  }

  const isAll = selectedOwnerId === 'all'

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatINRShort}
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconSize={8}
          iconType="circle"
          formatter={(val) => <span className="text-xs text-muted-foreground">{val}</span>}
        />
        
        {isAll ? (
          <>
            <defs>
              <linearGradient id="totalNetWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="Total Net Worth"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#totalNetWorthGradient)"
              dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#818cf8' }}
            />
            {owners.map((owner) => (
              <Line
                key={owner.id}
                type="monotone"
                dataKey={owner.name}
                stroke={colorHexMap[owner.color] || '#6366f1'}
                strokeWidth={2}
                dot={{ fill: colorHexMap[owner.color] || '#6366f1', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </>
        ) : (
          <>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="Net Worth"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
              dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#818cf8' }}
            />
            <Line
              type="monotone"
              dataKey="Assets"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Liabilities"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ fill: '#f43f5e', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

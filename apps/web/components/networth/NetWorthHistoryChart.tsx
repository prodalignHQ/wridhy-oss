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

interface Snapshot {
  id: string
  snapshotDate: string | Date
  totalAssets: string | number
  totalLiabilities: string | number
  netWorth: string | number
}

interface NetWorthHistoryChartProps {
  snapshots: Snapshot[]
}

function formatLakhs(value: number): string {
  if (Math.abs(value) >= 10_00_000) {
    return `₹${(value / 10_00_000).toFixed(1)}Cr`
  }
  if (Math.abs(value) >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(1)}L`
  }
  if (Math.abs(value) >= 1_000) {
    return `₹${(value / 1_000).toFixed(0)}K`
  }
  return `₹${value.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-zinc-400 text-xs mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-zinc-300 capitalize">{entry.name}:</span>
          <span className="font-mono font-semibold text-zinc-100">
            {formatLakhs(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function NetWorthHistoryChart({ snapshots }: NetWorthHistoryChartProps) {
  if (snapshots.length < 2) {
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
          <p className="text-zinc-400 font-medium">Not enough data to show a trend</p>
          <p className="text-zinc-600 text-sm mt-1">
            Save at least 2 snapshots to see your net worth over time
          </p>
        </div>
      </div>
    )
  }

  const data = snapshots.map((s) => ({
    month: format(new Date(s.snapshotDate), 'MMM yy'),
    Assets: parseFloat(s.totalAssets as string),
    Liabilities: parseFloat(s.totalLiabilities as string),
    'Net Worth': parseFloat(s.netWorth as string),
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatLakhs}
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconSize={8}
          iconType="circle"
          formatter={(val) => <span className="text-xs text-zinc-400">{val}</span>}
        />
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
      </ComposedChart>
    </ResponsiveContainer>
  )
}

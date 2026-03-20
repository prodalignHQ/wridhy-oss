'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Snapshot {
  id: string
  snapshotDate: string
  netWorth: string
  totalAssets: string
  totalLiabilities: string
}

export function NetWorthWidget() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .fetch<Snapshot[]>('/v1/networth/history')
      .then(setSnapshots)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots[snapshots.length - 2]

  const latestNW = latest ? parseFloat(latest.netWorth) : null
  const delta = latest && previous ? parseFloat(latest.netWorth) - parseFloat(previous.netWorth) : null

  const isPositive = latestNW !== null && latestNW >= 0
  const deltaPositive = delta !== null && delta >= 0

  return (
    <Link
      href="/networth"
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Net Worth</p>

          {loading ? (
            <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded" />
          ) : latestNW === null ? (
            <div>
              <p className="text-xl font-bold text-zinc-500 font-mono">Not tracked yet</p>
              <p className="text-xs text-zinc-600 mt-1">Click to add assets and liabilities</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p
                className={cn(
                  'text-3xl font-bold font-mono tabular-nums',
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {isPositive ? '' : '−'}
                {formatINR(Math.abs(latestNW))}
              </p>

              {delta !== null && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    deltaPositive ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {deltaPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {deltaPositive ? '+' : '−'}
                  {formatINR(Math.abs(delta))} since last snapshot
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1">
          <span className="text-xs">View details</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </Link>
  )
}

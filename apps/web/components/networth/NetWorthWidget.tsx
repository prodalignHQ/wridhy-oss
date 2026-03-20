'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/format'
import { useAuthStore } from '@/lib/store/auth.store'
import { apiClient } from '@/lib/api'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

interface Snapshot {
  id: string
  yearOffset: number
  month: number
  netWorth: string | number
  totalAssets: string | number
  totalLiabilities: string | number
}

export function NetWorthWidget() {
  const user = useAuthStore((state) => state.user)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const res = await apiClient.fetch<Snapshot[]>('/v1/networth/history')
        setSnapshots(res)
      } catch (error) {
        console.error('Failed to load net worth history for widget', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user])

  if (!user) return null

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">Net Worth</h3>
            <div className="h-6 w-16 bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="flex items-end justify-between">
            <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
            <Loader2 className="animate-spin text-zinc-600 h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null

  const netWorthValue = latest ? Number(latest.netWorth) : 0
  
  let delta = 0
  let isPositive = true
  let isNeutral = true

  if (latest && previous) {
    const prevVal = Number(previous.netWorth)
    delta = netWorthValue - prevVal
    isPositive = delta >= 0
    isNeutral = delta === 0
  } else if (latest && !previous) {
    delta = netWorthValue
    isPositive = delta >= 0
    isNeutral = delta === 0
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const prevMonthName = previous ? monthNames[previous.month - 1] : 'start'

  return (
    <Link href="/networth" className="block focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-xl">
      <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all duration-300 cursor-pointer group h-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">Net Worth</h3>
            {latest && (
              <div
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  isNeutral
                    ? 'text-zinc-400 bg-zinc-800/50'
                    : isPositive
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-rose-400 bg-rose-400/10'
                }`}
              >
                {isNeutral ? (
                  <Minus size={12} />
                ) : isPositive ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                <span>
                  {isNeutral ? '' : isPositive ? '+' : ''}
                  {formatINR(delta)}
                </span>
              </div>
            )}
            {!latest && (
              <div className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-full">
                No data
              </div>
            )}
          </div>
          
          <div className="flex flex-col">
            <span className={`text-2xl font-semibold tracking-tight font-mono ${latest && netWorthValue < 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
              {latest ? formatINR(netWorthValue) : '—'}
            </span>
            
            <span className="text-[11px] text-zinc-500 mt-1 h-4">
              {latest && previous && (
                <>Change since {prevMonthName} {previous.yearOffset + 2026}</>
              )}
              {latest && !previous && (
                <>Initial snapshot</>
              )}
              {!latest && (
                <>Click to get started</>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

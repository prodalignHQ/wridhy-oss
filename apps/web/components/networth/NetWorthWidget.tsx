'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, UserCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { formatINR } from '@/lib/format'
import { useAuthStore } from '@/lib/store/auth.store'
import { apiClient } from '@/lib/api'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

interface Snapshot {
  id: string
  snapshotDate: string
  netWorth: string | number
  totalAssets: string | number
  totalLiabilities: string | number
  ownerId?: string | null
}

interface LiveNetWorth {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

interface Owner {
  id: string
  name: string
  isDefault: boolean
  color: string
}

interface NetWorthWidgetProps {
  ownerId?: string
  ownerName?: string
  className?: string
}

export function NetWorthWidget({ ownerId: propOwnerId, ownerName: propOwnerName, className }: NetWorthWidgetProps) {
  const user = useAuthStore((state) => state.user)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [liveData, setLiveData] = useState<LiveNetWorth | null>(null)
  const [ownerInfo, setOwnerInfo] = useState<{ id: string; name: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) return
      setIsLoading(true)
      try {
        let targetOwnerId = propOwnerId
        let targetOwnerName = propOwnerName

        if (!targetOwnerId) {
          const owners = await apiClient.fetch<Owner[]>('/v1/owners').catch(() => [])
          const defaultOwner = owners.find((o) => o.isDefault) || owners[0]
          if (defaultOwner) {
            targetOwnerId = defaultOwner.id
            targetOwnerName = defaultOwner.name
          }
        }

        if (targetOwnerId) {
          setOwnerInfo({ id: targetOwnerId, name: targetOwnerName || 'You' })
          const query = `?ownerId=${targetOwnerId}`
          const [liveRes, histRes] = await Promise.all([
            apiClient.fetch<LiveNetWorth>(`/v1/networth${query}`).catch(() => null),
            apiClient.fetch<Snapshot[]>(`/v1/networth/history${query}`).catch(() => []),
          ])
          setLiveData(liveRes)
          setSnapshots(histRes)
        } else {
          // Fallback if no owner
          const [liveRes, histRes] = await Promise.all([
            apiClient.fetch<LiveNetWorth>('/v1/networth').catch(() => null),
            apiClient.fetch<Snapshot[]>('/v1/networth/history').catch(() => []),
          ])
          setLiveData(liveRes)
          setSnapshots(histRes)
        }
      } catch (error) {
        console.error('Failed to load net worth history for widget', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user, propOwnerId, propOwnerName])

  if (!user) return null

  if (isLoading) {
    return (
      <Card className={`bg-card border-border hover:border-border transition-colors ${className ?? ''}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex items-end justify-between">
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <Loader2 className="animate-spin text-muted-foreground/70 h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Determine current value: prioritize live calculated net worth, fallback to latest snapshot
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const currentNetWorth = liveData !== null ? liveData.netWorth : (latestSnapshot ? Number(latestSnapshot.netWorth) : 0)

  // Find previous snapshot to compute delta against
  let previousSnapshot: Snapshot | null = null
  if (liveData !== null && latestSnapshot) {
    // If live value is active and we have snapshots:
    // If the latest snapshot is from a previous month or date, compare against it.
    // If the latest snapshot is from today and values are identical, compare with snapshot before it.
    if (snapshots.length > 1 && Math.abs(currentNetWorth - Number(latestSnapshot.netWorth)) < 1) {
      previousSnapshot = snapshots[snapshots.length - 2]
    } else {
      previousSnapshot = latestSnapshot
    }
  } else if (snapshots.length > 1) {
    previousSnapshot = snapshots[snapshots.length - 2]
  }

  let delta = 0
  let isPositive = true
  let isNeutral = true

  if (previousSnapshot) {
    const prevVal = Number(previousSnapshot.netWorth)
    delta = currentNetWorth - prevVal
    isPositive = delta > 0
    isNeutral = delta === 0
  } else if (latestSnapshot || liveData !== null) {
    delta = currentNetWorth
    isPositive = delta >= 0
    isNeutral = delta === 0
  }

  const prevDateLabel = previousSnapshot
    ? format(new Date(previousSnapshot.snapshotDate), 'dd MMM yyyy')
    : (latestSnapshot ? format(new Date(latestSnapshot.snapshotDate), 'dd MMM yyyy') : null)

  const hasData = liveData !== null || latestSnapshot !== null

  return (
    <Link href="/networth" className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl h-full">
      <Card className={`bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer group h-full ${className ?? ''}`}>
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/90 transition-colors">
                  Personal Net Worth
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                  <UserCheck size={10} />
                  {ownerInfo?.name || 'You'}
                </span>
              </div>
              {hasData && (
                <div
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isNeutral
                      ? 'text-muted-foreground bg-muted/50'
                      : isPositive
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10'
                      : 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-400/10'
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
              {!hasData && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  No data
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <span className={`text-3xl font-bold tracking-tight font-mono ${hasData && currentNetWorth < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                {hasData ? formatINR(currentNetWorth) : '—'}
              </span>
              
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                {previousSnapshot ? (
                  <>Change since {prevDateLabel}</>
                ) : latestSnapshot ? (
                  <>First snapshot on {prevDateLabel}</>
                ) : (
                  <>Click to add assets and calculate net worth</>
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Isolated to your personal assets</span>
            <span className="text-primary group-hover:underline">View Net Worth &rarr;</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

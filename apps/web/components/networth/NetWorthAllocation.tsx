'use client'

import { useMemo } from 'react'
import { TrendingUp, ShieldCheck, Banknote, PieChart, Layers } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { resolveAssetTag, ASSET_TAG_COLORS, ASSET_TAG_LABELS, AssetTag } from '@momoney/utils'
import { cn } from '@/lib/utils'

interface NetWorthAllocationProps {
  assets: any[]
  totalAssets: number
  netWorth: number
  className?: string
}

export function NetWorthAllocation({ assets, totalAssets, netWorth, className }: NetWorthAllocationProps) {
  const allocation = useMemo(() => {
    let equityTotal = 0
    let debtTotal = 0
    let cashTotal = 0
    let mixedTotal = 0

    let equityCount = 0
    let debtCount = 0
    let cashCount = 0
    let mixedCount = 0

    assets.forEach((asset) => {
      const val = parseFloat(asset.value || 0)
      const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)

      if (tag === 'equity') {
        equityTotal += val
        equityCount++
      } else if (tag === 'debt') {
        debtTotal += val
        debtCount++
      } else if (tag === 'cash') {
        cashTotal += val
        cashCount++
      } else if (tag === 'mixed') {
        mixedTotal += val
        mixedCount++
      }
    })

    const safeTotalAssets = totalAssets > 0 ? totalAssets : (equityTotal + debtTotal + cashTotal + mixedTotal)
    const safeNetWorth = Math.abs(netWorth) > 0 ? netWorth : safeTotalAssets

    const calcPctAssets = (val: number) => (safeTotalAssets > 0 ? (val / safeTotalAssets) * 100 : 0)
    const calcPctNW = (val: number) => (safeNetWorth > 0 ? (val / safeNetWorth) * 100 : 0)

    return {
      equity: {
        total: equityTotal,
        count: equityCount,
        pctAssets: calcPctAssets(equityTotal),
        pctNW: calcPctNW(equityTotal),
      },
      debt: {
        total: debtTotal,
        count: debtCount,
        pctAssets: calcPctAssets(debtTotal),
        pctNW: calcPctNW(debtTotal),
      },
      cash: {
        total: cashTotal,
        count: cashCount,
        pctAssets: calcPctAssets(cashTotal),
        pctNW: calcPctNW(cashTotal),
      },
      mixed: {
        total: mixedTotal,
        count: mixedCount,
        pctAssets: calcPctAssets(mixedTotal),
        pctNW: calcPctNW(mixedTotal),
      },
      totalAssets: safeTotalAssets,
    }
  }, [assets, totalAssets, netWorth])

  if (assets.length === 0) {
    return null
  }

  const items = [
    {
      key: 'equity' as AssetTag,
      label: 'Equity',
      icon: TrendingUp,
      data: allocation.equity,
      color: ASSET_TAG_COLORS.equity,
      barBg: 'bg-primary',
      badgeBg: 'bg-primary/10 text-primary border-primary/20',
      description: 'Stocks, Equity Mutual Funds, Crypto',
    },
    {
      key: 'debt' as AssetTag,
      label: 'Debt',
      icon: ShieldCheck,
      data: allocation.debt,
      color: ASSET_TAG_COLORS.debt,
      barBg: 'bg-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      description: 'Fixed Deposits, RD, PPF, Debt MFs',
    },
    {
      key: 'cash' as AssetTag,
      label: 'Cash',
      icon: Banknote,
      data: allocation.cash,
      color: ASSET_TAG_COLORS.cash,
      barBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      description: 'Savings Accounts, Liquid Cash',
    },
    ...(allocation.mixed.total > 0
      ? [
          {
            key: 'mixed' as AssetTag,
            label: 'Mixed / Hybrid',
            icon: Layers,
            data: allocation.mixed,
            color: ASSET_TAG_COLORS.mixed,
            barBg: 'bg-purple-500',
            badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            description: 'Hybrid Funds & Balanced Assets',
          },
        ]
      : []),
  ]

  return (
    <div className={cn('bg-card border border-border rounded-xl p-5 sm:p-6 space-y-5', className)}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-secondary text-foreground">
            <PieChart size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Asset Allocation</h2>
            <p className="text-xs text-muted-foreground">
              Breakdown of your portfolio across Equity, Debt, and Cash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 font-medium">
              <span className={cn('w-2.5 h-2.5 rounded-full', item.barBg)} />
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono text-foreground font-semibold">
                {item.data.pctAssets.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-segment allocation progress bar */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-secondary/80 rounded-full overflow-hidden flex gap-[2px] p-[2px]">
          {items.map((item) => {
            const width = item.data.pctAssets
            if (width <= 0) return null
            return (
              <div
                key={item.key}
                style={{ width: `${width}%` }}
                title={`${item.label}: ${formatINR(item.data.total)} (${width.toFixed(1)}% of assets)`}
                className={cn(
                  'h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 relative group cursor-pointer hover:opacity-90',
                  item.barBg
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className={cn('grid grid-cols-1 gap-3 sm:gap-4', items.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.key}
              className="bg-secondary/40 border border-border/60 hover:border-border transition-colors rounded-xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-md border text-xs', item.badgeBg)}>
                    <Icon size={14} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold font-mono', item.badgeBg)}>
                  {item.data.pctAssets.toFixed(1)}%
                </span>
              </div>

              <div>
                <p className="text-xl font-bold font-mono text-foreground">
                  {formatINR(item.data.total)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>
                    {item.data.count} asset{item.data.count === 1 ? '' : 's'}
                  </span>
                  {netWorth > 0 && (
                    <span className="font-mono">
                      {item.data.pctNW.toFixed(1)}% of net worth
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

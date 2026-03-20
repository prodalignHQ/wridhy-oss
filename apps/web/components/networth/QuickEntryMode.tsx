'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/format'

interface QuickEntryModeProps {
  onSaveSnapshot: (totalAssets: number, totalLiabilities: number) => Promise<void>
}

export function QuickEntryMode({ onSaveSnapshot }: QuickEntryModeProps) {
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [loading, setLoading] = useState(false)

  const assetValue = parseFloat(assets) || 0
  const liabilityValue = parseFloat(liabilities) || 0
  const netWorth = assetValue - liabilityValue
  const isPositive = netWorth >= 0
  const hasValues = assets !== '' || liabilities !== ''

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSaveSnapshot(assetValue, liabilityValue)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-10 py-8 max-w-lg mx-auto">
      {/* Inputs */}
      <div className="w-full grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold text-center">
            Total Assets (₹)
          </label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={assets}
            onChange={(e) => setAssets(e.target.value)}
            className="text-3xl font-mono font-bold text-center w-full bg-card border-b-2 border-border focus:border-indigo-500 outline-none p-4 text-emerald-400 placeholder:text-muted-foreground/60 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold text-center">
            Total Liabilities (₹)
          </label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={liabilities}
            onChange={(e) => setLiabilities(e.target.value)}
            className="text-3xl font-mono font-bold text-center w-full bg-card border-b-2 border-border focus:border-indigo-500 outline-none p-4 text-rose-400 placeholder:text-muted-foreground/60 transition-colors"
          />
        </div>
      </div>

      {/* Net Worth computed */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Net Worth</p>
        <p
          className={cn(
            'text-5xl font-bold font-mono text-center transition-colors',
            !hasValues && 'text-muted-foreground/60',
            hasValues && isPositive && 'text-emerald-400',
            hasValues && !isPositive && 'text-rose-400'
          )}
        >
          {hasValues ? (isPositive ? '' : '−') + formatINR(Math.abs(netWorth)) : '—'}
        </p>
        {hasValues && (
          <p className="text-xs text-muted-foreground font-mono">
            {formatINR(assetValue)} assets − {formatINR(liabilityValue)} liabilities
          </p>
        )}
      </div>

      {/* Save Snapshot */}
      <Button
        onClick={handleSave}
        disabled={!hasValues || loading}
        className="bg-indigo-600 hover:bg-indigo-500 px-8 text-sm"
      >
        {loading ? 'Saving snapshot…' : 'Save Snapshot'}
      </Button>

      <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
        Quick Entry saves a snapshot with the totals above — it doesn't update your detailed
        asset and liability breakdown. Switch to Detailed mode to manage individual entries.
      </p>
    </div>
  )
}

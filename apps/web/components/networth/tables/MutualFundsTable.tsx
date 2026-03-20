'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { MutualFundModal } from '../modals/MutualFundModal'
import { formatINR } from '@/lib/format'

export interface MutualFundAsset {
  id: string
  name: string
  type: 'mutual_fund'
  value: string // Present Value
  currency: string
  valuationDate: string
  metadata: {
    folioNumber?: string
    investedAmount?: number
    category?: string
    comments?: string
  }
}

interface MutualFundsTableProps {
  assets: MutualFundAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MutualFundsTable({ assets, onAdd, onDelete }: MutualFundsTableProps) {
  const [editAsset, setEditAsset] = useState<MutualFundAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotalPresent = assets.reduce((s, a) => s + parseFloat(a.value), 0)
  const subtotalInvested = assets.reduce((s, a) => s + (a.metadata.investedAmount || 0), 0)
  const totalGain = subtotalPresent - subtotalInvested

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
        <p>No mutual funds added.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Mutual Fund
        </button>
        {isAdding && (
          <MutualFundModal
            open
            onClose={() => setIsAdding(false)}
            onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Group heading */}
      <div className="flex items-center justify-between px-3 py-2 mt-2">
        <div className="text-xs uppercase font-semibold text-zinc-500 tracking-widest">
          Mutual Funds
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={12} />
          Add Fund
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-zinc-500 font-semibold border-b border-zinc-800/50">
        <span>Fund Name</span>
        <span>Category / Folio</span>
        <span className="text-right">Invested</span>
        <span className="text-right">Present Value</span>
        <span className="text-right">Unrealized</span>
        <span />
      </div>

      {/* Rows */}
      {assets.map((asset) => {
        const invested = asset.metadata.investedAmount || 0
        const present = parseFloat(asset.value)
        const gain = present - invested
        const gainPercent = invested > 0 ? (gain / invested) * 100 : 0

        return (
          <div
            key={asset.id}
            className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group border-b border-zinc-800/30 last:border-0"
          >
            <div className="flex flex-col">
              <span className="text-sm text-zinc-200">{asset.name}</span>
              {asset.metadata.comments && (
                <span className="text-xs text-zinc-500 truncate">{asset.metadata.comments}</span>
              )}
            </div>
            
            <div className="flex flex-col gap-1 items-start">
              {asset.metadata.category && (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px] leading-none px-1.5 py-0.5">
                  {asset.metadata.category}
                </Badge>
              )}
              {asset.metadata.folioNumber && (
                <span className="text-xs font-mono text-zinc-500">{asset.metadata.folioNumber}</span>
              )}
            </div>

            <span className="text-right font-mono text-sm text-zinc-400">
              {formatINR(invested)}
            </span>
            <span className="text-right font-mono text-sm text-emerald-400">
              {formatINR(present)}
            </span>
            <div className="text-right flex flex-col">
              <span className={`font-mono text-sm ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {gain >= 0 ? '+' : ''}{formatINR(gain)}
              </span>
              <span className={`text-[10px] ${gain >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                {gain >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%
              </span>
            </div>

            <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
              <button
                onClick={() => setEditAsset(asset)}
                className="p-1 text-zinc-500 hover:text-zinc-200 rounded"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setDeleteId(asset.id)}
                className="p-1 text-zinc-500 hover:text-rose-400 rounded"
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        )
      })}

      {/* Subtotal row */}
      {assets.length > 0 && (
        <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 py-3 bg-zinc-900/50 rounded-b-lg border-t border-zinc-800 mt-1">
          <span className="text-xs text-zinc-400 font-semibold flex items-center">
            Total Mutual Funds
          </span>
          <span />
          <span className="text-right font-mono text-sm font-semibold text-zinc-300">
            {formatINR(subtotalInvested)}
          </span>
          <span className="text-right font-mono text-sm font-semibold text-emerald-400">
            {formatINR(subtotalPresent)}
          </span>
          <div className="text-right flex flex-col">
            <span className={`font-mono text-sm font-semibold ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
               {totalGain >= 0 ? '+' : ''}{formatINR(totalGain)}
            </span>
            <span className={`text-[10px] ${totalGain >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
               {totalGain >= 0 ? '+' : ''}{subtotalInvested > 0 ? ((totalGain / subtotalInvested) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <span />
        </div>
      )}

      {/* Modals */}
      {isAdding && (
        <MutualFundModal
          open
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <MutualFundModal
          open
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onSave={async (data: any, id?: string) => { await onAdd(data, id); setEditAsset(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(val) => !val && setDeleteId(null)}
        title="Delete Mutual Fund"
        description="This asset will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}

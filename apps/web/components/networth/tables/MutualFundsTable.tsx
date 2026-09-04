'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { MutualFundModal } from '../modals/MutualFundModal'
import { formatINR } from '@/lib/format'
import { InlineInput } from './InlineInput'

import { cn } from '@/lib/utils'
import { resolveAssetTag, ASSET_TAG_COLORS, ASSET_TAG_LABELS } from '@momoney/utils'

const colorMap: Record<string, string> = {
  indigo: 'bg-primary/10 text-primary border-primary/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

export interface MutualFundAsset {
  id: string
  ownerId?: string | null
  name: string
  type: 'mutual_fund'
  value: string // Present Value
  currency: string
  equityDebtTag?: string | null
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
  owners?: any[]
  defaultOwnerId?: string
  inlineEdit?: boolean
}

export function MutualFundsTable({ assets, onAdd, onDelete, owners, defaultOwnerId, inlineEdit }: MutualFundsTableProps) {
  const [editAsset, setEditAsset] = useState<MutualFundAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotalPresent = assets.reduce((s, a) => s + parseFloat(a.value), 0)
  const subtotalInvested = assets.reduce((s, a) => s + (a.metadata.investedAmount || 0), 0)
  const totalGain = subtotalPresent - subtotalInvested

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        <p>No mutual funds added.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-primary hover:text-primary text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Mutual Fund
        </button>
        {isAdding && (
          <MutualFundModal
            open
            owners={owners}
            defaultOwnerId={defaultOwnerId}
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
        <div className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">
          Mutual Funds
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
        >
          <Plus size={12} />
          Add Fund
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold border-b border-border/50">
        <span>Fund Name</span>
        <span>Class & Folio</span>
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
        const owner = owners?.find(o => o.id === asset.ownerId)
        const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
        const tagStyle = ASSET_TAG_COLORS[tag]

        return (
          <div
            key={asset.id}
            className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
          >
            <div className="flex flex-col">
              <span className="text-sm text-foreground/90 flex items-center gap-2">
                {asset.name}
                {owner && (
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-medium shrink-0", colorMap[owner.color] || colorMap['indigo'])}>
                    {owner.name}
                  </span>
                )}
              </span>
              {asset.metadata.comments && (
                <span className="text-xs text-muted-foreground truncate">{asset.metadata.comments}</span>
              )}
            </div>
            
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded-full border leading-tight', tagStyle.badge)}>
                  {ASSET_TAG_LABELS[tag]}
                </span>
                {asset.metadata.category && (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px] leading-none px-1.5 py-0.5">
                    {asset.metadata.category}
                  </Badge>
                )}
              </div>
              {asset.metadata.folioNumber && (
                <span className="text-xs font-mono text-muted-foreground">{asset.metadata.folioNumber}</span>
              )}
            </div>

            {inlineEdit ? (
              <InlineInput
                initialValue={invested}
                onSave={async (val) => {
                  await onAdd({
                    name: asset.name,
                    type: asset.type,
                    value: parseFloat(asset.value),
                    currency: asset.currency,
                    valuationDate: asset.valuationDate,
                    metadata: {
                      ...asset.metadata,
                      investedAmount: val,
                    },
                    ownerId: asset.ownerId,
                  }, asset.id)
                }}
                className="h-7 text-xs bg-background text-foreground border-border text-right max-w-[100px] ml-auto font-mono"
              />
            ) : (
              <span className="text-right font-mono text-sm text-muted-foreground">
                {formatINR(invested)}
              </span>
            )}
            {inlineEdit ? (
              <InlineInput
                initialValue={present}
                onSave={async (val) => {
                  await onAdd({
                    name: asset.name,
                    type: asset.type,
                    value: val,
                    currency: asset.currency,
                    valuationDate: asset.valuationDate,
                    metadata: asset.metadata,
                    ownerId: asset.ownerId,
                  }, asset.id)
                }}
                className="h-7 text-xs bg-background text-foreground border-border text-right max-w-[100px] ml-auto font-mono"
              />
            ) : (
              <span className="text-right font-mono text-sm text-emerald-400">
                {formatINR(present)}
              </span>
            )}
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
                className="p-1 text-muted-foreground hover:text-foreground/90 rounded"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setDeleteId(asset.id)}
                className="p-1 text-muted-foreground hover:text-rose-400 rounded"
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        )
      })}

      {/* Subtotal row */}
      {assets.length > 0 && (
        <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 py-3 bg-card/50 rounded-b-lg border-t border-border mt-1">
          <span className="text-xs text-muted-foreground font-semibold flex items-center">
            Total Mutual Funds
          </span>
          <span />
          <span className="text-right font-mono text-sm font-semibold text-foreground/80">
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
          owners={owners}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <MutualFundModal
          open
          asset={editAsset}
          owners={owners}
          defaultOwnerId={defaultOwnerId}
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

'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { GenericAssetModal } from '../modals/GenericAssetModal'
import { formatINR } from '@/lib/format'
import { InlineInput } from './InlineInput'

import { cn } from '@/lib/utils'
import { ASSET_TAG_COLORS, ASSET_TAG_LABELS, resolveAssetTag } from '@momoney/utils'

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

export interface GenericAsset {
  id: string
  ownerId?: string | null
  name: string
  type: 'real_estate' | 'crypto' | 'cash' | 'other'
  value: string // Present Value
  currency: string
  equityDebtTag?: string | null
  valuationDate: string
  metadata: {
    comments?: string
  }
}

interface GenericAssetTableProps {
  assets: GenericAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  owners?: any[]
  defaultOwnerId?: string
  inlineEdit?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other'
}

export function GenericAssetTable({ assets, onAdd, onDelete, owners, defaultOwnerId, inlineEdit }: GenericAssetTableProps) {
  const [editAsset, setEditAsset] = useState<GenericAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotal = assets.reduce((s, a) => s + parseFloat(a.value), 0)

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        <p>No other assets added.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Asset
        </button>
        {isAdding && (
          <GenericAssetModal
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
      <div className="flex items-center justify-between px-3 py-2 mt-2">
        <div className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">
          Other Assets
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={12} />
          Add Asset
        </button>
      </div>

      <div className="grid grid-cols-[2fr_120px_160px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold border-b border-border/50">
        <span>Name & Comments</span>
        <span>Group</span>
        <span className="text-right">Estimated Value</span>
        <span />
      </div>

      {assets.map((asset) => {
        const owner = owners?.find(o => o.id === asset.ownerId)
        const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
        const tagStyle = ASSET_TAG_COLORS[tag]

        return (
          <div
            key={asset.id}
            className="grid grid-cols-[2fr_120px_160px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
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
              {asset.metadata?.comments && (
                <span className="text-[10px] text-muted-foreground truncate mr-4">{asset.metadata.comments}</span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded-full border leading-tight', tagStyle.badge)}>
                {ASSET_TAG_LABELS[tag]}
              </span>
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px] w-fit">
                {TYPE_LABELS[asset.type] || asset.type}
              </Badge>
            </div>

            {inlineEdit ? (
              <InlineInput
                initialValue={parseFloat(asset.value)}
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
                className="h-7 text-xs bg-background text-foreground border-border text-right max-w-[120px] ml-auto font-mono"
              />
            ) : (
              <span className="text-right font-mono text-sm text-emerald-400">
                {formatINR(parseFloat(asset.value))}
              </span>
            )}

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

      {assets.length > 0 && (
        <div className="grid grid-cols-[2fr_120px_160px_80px] gap-3 px-3 py-3 bg-card/50 rounded-b-lg border-t border-border mt-1">
          <span className="text-xs text-muted-foreground font-semibold">
            Total Other Assets
          </span>
          <span />
          <span className="text-right font-mono text-sm font-semibold text-emerald-400">
            {formatINR(subtotal)}
          </span>
          <span />
        </div>
      )}

      {isAdding && (
        <GenericAssetModal
          open
          owners={owners}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <GenericAssetModal
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
        title="Delete Asset"
        description="This asset will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}

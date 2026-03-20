'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { GenericAssetModal } from '../modals/GenericAssetModal'
import { formatINR } from '@/lib/format'

export interface GenericAsset {
  id: string
  name: string
  type: 'real_estate' | 'crypto' | 'cash' | 'other'
  value: string // Present Value
  currency: string
  valuationDate: string
  metadata: {
    comments?: string
  }
}

interface GenericAssetTableProps {
  assets: GenericAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const TYPE_LABELS: Record<string, string> = {
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other'
}

export function GenericAssetTable({ assets, onAdd, onDelete }: GenericAssetTableProps) {
  const [editAsset, setEditAsset] = useState<GenericAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotal = assets.reduce((s, a) => s + parseFloat(a.value), 0)

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
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
        <div className="text-xs uppercase font-semibold text-zinc-500 tracking-widest">
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

      <div className="grid grid-cols-[2fr_120px_160px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-zinc-500 font-semibold border-b border-zinc-800/50">
        <span>Name & Comments</span>
        <span>Group</span>
        <span className="text-right">Estimated Value</span>
        <span />
      </div>

      {assets.map((asset) => (
        <div
          key={asset.id}
          className="grid grid-cols-[2fr_120px_160px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group border-b border-zinc-800/30 last:border-0"
        >
          <div className="flex flex-col">
            <span className="text-sm text-zinc-200">{asset.name}</span>
            {asset.metadata?.comments && (
              <span className="text-[10px] text-zinc-500 truncate mr-4">{asset.metadata.comments}</span>
            )}
          </div>
          
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px] w-fit">
            {TYPE_LABELS[asset.type] || asset.type}
          </Badge>

          <span className="text-right font-mono text-sm text-emerald-400">
            {formatINR(parseFloat(asset.value))}
          </span>

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
      ))}

      {assets.length > 0 && (
        <div className="grid grid-cols-[2fr_120px_160px_80px] gap-3 px-3 py-3 bg-zinc-900/50 rounded-b-lg border-t border-zinc-800 mt-1">
          <span className="text-xs text-zinc-400 font-semibold">
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
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <GenericAssetModal
          open
          asset={editAsset}
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

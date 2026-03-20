'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { AddAssetModal, type Asset } from './AddAssetModal'
import { formatINR } from '@/lib/format'

const ASSET_TYPE_LABELS: Record<string, string> = {
  bank_account: 'Bank Accounts',
  investment: 'Investments',
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other',
}

const ASSET_TYPE_ORDER = ['bank_account', 'investment', 'real_estate', 'crypto', 'cash', 'other']

interface AssetTableProps {
  assets: Asset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function AssetTable({ assets, onAdd, onDelete }: AssetTableProps) {
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [addForType, setAddForType] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Group assets by type, preserving order
  const grouped = ASSET_TYPE_ORDER.reduce<Record<string, Asset[]>>((acc, type) => {
    const group = assets.filter((a) => a.type === type)
    if (group.length > 0) acc[type] = group
    return acc
  }, {})

  // Also add any types not in order list (shouldn't happen but safe)
  assets.forEach((a) => {
    if (!grouped[a.type]) grouped[a.type] = [a]
  })

  if (assets.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        <p>No assets yet.</p>
        <button
          onClick={() => setAddForType('bank_account')}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs"
        >
          + Add your first asset
        </button>
        {addForType && (
          <AddAssetModal
            open
            defaultType={addForType}
            onClose={() => setAddForType(null)}
            onSave={async (data) => { await onAdd(data); setAddForType(null) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_140px_160px_140px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-zinc-500 font-semibold">
        <span>Name</span>
        <span>Type</span>
        <span className="text-right">Value</span>
        <span>Valuation Date</span>
        <span />
      </div>

      {Object.entries(grouped).map(([type, items]) => {
        const subtotal = items.reduce((s, a) => s + parseFloat(a.value), 0)

        return (
          <div key={type}>
            {/* Group heading */}
            <div className="text-xs uppercase font-semibold text-zinc-500 tracking-widest px-3 py-2 mt-2">
              {ASSET_TYPE_LABELS[type] ?? type}
            </div>

            {/* Rows */}
            {items.map((asset) => (
              <div
                key={asset.id}
                className="grid grid-cols-[1fr_140px_160px_140px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group"
              >
                <span className="text-sm text-zinc-200">{asset.name}</span>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs w-fit">
                  {ASSET_TYPE_LABELS[asset.type] ?? asset.type}
                </Badge>
                <span className="text-right font-mono text-sm text-emerald-400">
                  {formatINR(parseFloat(asset.value))}
                </span>
                <span className="text-sm text-zinc-500">
                  {new Date(asset.valuationDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
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

            {/* Subtotal row */}
            <div className="grid grid-cols-[1fr_140px_160px_140px_80px] gap-3 px-3 py-2 border-t border-zinc-800 mt-1">
              <span className="text-xs text-zinc-500 font-semibold">
                Subtotal — {ASSET_TYPE_LABELS[type] ?? type}
              </span>
              <span />
              <span className="text-right font-mono text-sm font-semibold text-zinc-200">
                {formatINR(subtotal)}
              </span>
              <span />
              <span />
            </div>

            {/* Add link for this group */}
            <button
              onClick={() => setAddForType(type)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors px-3 py-1.5"
            >
              <Plus size={12} />
              Add {ASSET_TYPE_LABELS[type] ?? type}
            </button>
          </div>
        )
      })}

      {/* Modals */}
      {editAsset && (
        <AddAssetModal
          open
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onSave={async (data, id) => { await onAdd(data, id); setEditAsset(null) }}
        />
      )}
      {addForType && (
        <AddAssetModal
          open
          defaultType={addForType}
          onClose={() => setAddForType(null)}
          onSave={async (data) => { await onAdd(data); setAddForType(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Asset"
        description="This asset will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { SavingsModal } from '../modals/SavingsModal'
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

export interface SavingsAsset {
  id: string
  ownerId?: string | null
  name: string
  type: 'savings_account'
  value: string // Current Balance
  currency: string
  equityDebtTag?: string | null
  valuationDate: string
  metadata: {
    accountNumber?: string
  }
}

interface SavingsTableProps {
  assets: SavingsAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  owners?: any[]
  defaultOwnerId?: string
  inlineEdit?: boolean
}

export function SavingsTable({ assets, onAdd, onDelete, owners, defaultOwnerId, inlineEdit }: SavingsTableProps) {
  const [editAsset, setEditAsset] = useState<SavingsAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotal = assets.reduce((s, a) => s + parseFloat(a.value), 0)

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        <p>No savings accounts added.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Savings Account
        </button>
        {isAdding && (
          <SavingsModal
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
          Savings Accounts
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={12} />
          Add Account
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_160px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold border-b border-border/50">
        <span>Bank Name</span>
        <span>Account Number</span>
        <span className="text-right">Current Balance</span>
        <span />
      </div>

      {assets.map((asset) => {
        const owner = owners?.find(o => o.id === asset.ownerId)
        const tag = resolveAssetTag(asset.type, asset.metadata, asset.equityDebtTag)
        const tagStyle = ASSET_TAG_COLORS[tag]

        return (
          <div
            key={asset.id}
            className="grid grid-cols-[1fr_1fr_160px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-foreground/90 flex items-center gap-2">
                {asset.name}
                {owner && (
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-medium shrink-0", colorMap[owner.color] || colorMap['indigo'])}>
                    {owner.name}
                  </span>
                )}
              </span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded-full border leading-tight', tagStyle.badge)}>
                {ASSET_TAG_LABELS[tag]}
              </span>
            </div>
            
            <span className="text-sm font-mono text-muted-foreground">
              {asset.metadata.accountNumber || <span className="text-muted-foreground/70 italic">Not provided</span>}
            </span>

            {inlineEdit ? (
              <InlineInput
                initialValue={parseFloat(asset.value)}
                onSave={async (val) => {
                  await onAdd({
                    name: asset.name,
                    type: 'savings_account',
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
        <div className="grid grid-cols-[1fr_1fr_160px_80px] gap-3 px-3 py-3 bg-card/50 rounded-b-lg border-t border-border mt-1">
          <span className="text-xs text-muted-foreground font-semibold">
            Total Savings
          </span>
          <span />
          <span className="text-right font-mono text-sm font-semibold text-emerald-400">
            {formatINR(subtotal)}
          </span>
          <span />
        </div>
      )}

      {isAdding && (
        <SavingsModal
          open
          owners={owners}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <SavingsModal
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
        title="Delete Savings Account"
        description="This asset will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}

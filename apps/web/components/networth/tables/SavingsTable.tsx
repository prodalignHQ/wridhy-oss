'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { SavingsModal } from '../modals/SavingsModal'
import { formatINR } from '@/lib/format'

export interface SavingsAsset {
  id: string
  name: string
  type: 'savings_account'
  value: string // Current Balance
  currency: string
  valuationDate: string
  metadata: {
    accountNumber?: string
  }
}

interface SavingsTableProps {
  assets: SavingsAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function SavingsTable({ assets, onAdd, onDelete }: SavingsTableProps) {
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

      {assets.map((asset) => (
        <div
          key={asset.id}
          className="grid grid-cols-[1fr_1fr_160px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
        >
          <span className="text-sm text-foreground/90">{asset.name}</span>
          
          <span className="text-sm font-mono text-muted-foreground">
            {asset.metadata.accountNumber || <span className="text-muted-foreground/70 italic">Not provided</span>}
          </span>

          <span className="text-right font-mono text-sm text-emerald-400">
            {formatINR(parseFloat(asset.value))}
          </span>

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
      ))}

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
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <SavingsModal
          open
          asset={editAsset}
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

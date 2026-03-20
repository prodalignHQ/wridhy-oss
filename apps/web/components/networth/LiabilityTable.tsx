'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { AddLiabilityModal, Liability } from './AddLiabilityModal'
import { formatINR } from '@/lib/format'

interface LiabilityTableProps {
  liabilities: Liability[]
  onAdd: (data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function LiabilityTable({ liabilities, onAdd, onDelete }: LiabilityTableProps) {
  const [editLiability, setEditLiability] = useState<Liability | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotal = liabilities.reduce((s, l) => s + parseFloat(l.outstandingAmount as any), 0)

  if (liabilities.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
        <p>No liabilities added.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Liability
        </button>
        {isAdding && (
          <AddLiabilityModal
            open
            onClose={() => setIsAdding(false)}
            onSave={async (data) => { await onAdd(data as any); setIsAdding(false) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-2 mt-2">
        <div className="text-xs uppercase font-semibold text-zinc-500 tracking-widest">
          Liabilities
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={12} />
          Add Liability
        </button>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr_120px_120px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-zinc-500 font-semibold border-b border-zinc-800/50">
        <span>Name & Type</span>
        <span>Details</span>
        <span className="text-right">Monthly Payment</span>
        <span className="text-right">Outstanding</span>
        <span />
      </div>

      {liabilities.map((liability) => (
        <div
          key={liability.id}
          className="grid grid-cols-[1.5fr_1fr_120px_120px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group border-b border-zinc-800/30 last:border-0"
        >
          <div className="flex flex-col">
            <span className="text-sm text-zinc-200">{liability.name}</span>
            <span className="text-[10px] text-zinc-500 capitalize">{liability.type.replace('_', ' ')}</span>
          </div>

          <span className="text-xs text-zinc-400">
            {liability.interestRate ? `${liability.interestRate}% APR` : <span className="text-zinc-600 italic">No rate</span>}
          </span>

          <span className="text-right font-mono text-sm text-zinc-400">
            {liability.monthlyPayment ? formatINR(parseFloat(liability.monthlyPayment as any)) : '—'}
          </span>
          <span className="text-right font-mono text-sm text-rose-400">
            {formatINR(parseFloat(liability.outstandingAmount as any))}
          </span>

          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
            <button
              onClick={() => setEditLiability(liability)}
              className="p-1 text-zinc-500 hover:text-zinc-200 rounded"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setDeleteId(liability.id)}
              className="p-1 text-zinc-500 hover:text-rose-400 rounded"
            >
              <Trash2 size={13} />
            </button>
          </span>
        </div>
      ))}

      {liabilities.length > 0 && (
        <div className="grid grid-cols-[1.5fr_1fr_120px_120px_80px] gap-3 px-3 py-3 bg-zinc-900/50 rounded-b-lg border-t border-zinc-800 mt-1">
          <span className="text-xs text-zinc-400 font-semibold">
            Total Liabilities
          </span>
          <span />
          <span />
          <span className="text-right font-mono text-sm font-semibold text-rose-400">
            {formatINR(subtotal)}
          </span>
          <span />
        </div>
      )}

      {isAdding && (
        <AddLiabilityModal
          open
          onClose={() => setIsAdding(false)}
          onSave={async (data) => { await onAdd(data as any); setIsAdding(false) }}
        />
      )}
      {editLiability && (
        <AddLiabilityModal
          open
          liability={editLiability}
          onClose={() => setEditLiability(null)}
          onSave={async (data, id) => { await onAdd(data as any, id); setEditLiability(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(val) => !val && setDeleteId(null)}
        title="Delete Liability"
        description="This liability will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}

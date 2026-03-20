'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { AddLiabilityModal, type Liability } from './AddLiabilityModal'
import { formatINR } from '@/lib/format'

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  home_loan: 'Home Loan',
  car_loan: 'Car Loan',
  credit_card: 'Credit Cards',
  student_loan: 'Student Loan',
  personal_loan: 'Personal Loan',
  other: 'Other',
}

const LIABILITY_TYPE_ORDER = [
  'home_loan',
  'car_loan',
  'personal_loan',
  'student_loan',
  'credit_card',
  'other',
]

interface LiabilityTableProps {
  liabilities: Liability[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function LiabilityTable({ liabilities, onAdd, onDelete }: LiabilityTableProps) {
  const [editLiability, setEditLiability] = useState<Liability | null>(null)
  const [addForType, setAddForType] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const grouped = LIABILITY_TYPE_ORDER.reduce<Record<string, Liability[]>>((acc, type) => {
    const group = liabilities.filter((l) => l.type === type)
    if (group.length > 0) acc[type] = group
    return acc
  }, {})

  liabilities.forEach((l) => {
    if (!grouped[l.type]) grouped[l.type] = [l]
  })

  if (liabilities.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        <p>No liabilities yet.</p>
        <button
          onClick={() => setAddForType('home_loan')}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs"
        >
          + Add your first liability
        </button>
        {addForType && (
          <AddLiabilityModal
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
      <div className="grid grid-cols-[1fr_150px_160px_120px_120px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-zinc-500 font-semibold">
        <span>Name</span>
        <span>Type</span>
        <span className="text-right">Outstanding</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Monthly EMI</span>
        <span />
      </div>

      {Object.entries(grouped).map(([type, items]) => {
        const subtotal = items.reduce((s, l) => s + parseFloat(l.outstandingAmount), 0)

        return (
          <div key={type}>
            <div className="text-xs uppercase font-semibold text-zinc-500 tracking-widest px-3 py-2 mt-2">
              {LIABILITY_TYPE_LABELS[type] ?? type}
            </div>

            {items.map((liability) => (
              <div
                key={liability.id}
                className="grid grid-cols-[1fr_150px_160px_120px_120px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group"
              >
                <span className="text-sm text-zinc-200">{liability.name}</span>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs w-fit">
                  {LIABILITY_TYPE_LABELS[liability.type] ?? liability.type}
                </Badge>
                <span className="text-right font-mono text-sm text-rose-400">
                  {formatINR(parseFloat(liability.outstandingAmount))}
                </span>
                <span className="text-right font-mono text-sm text-zinc-400">
                  {liability.interestRate ? `${liability.interestRate}%` : '—'}
                </span>
                <span className="text-right font-mono text-sm text-zinc-400">
                  {liability.monthlyPayment ? formatINR(parseFloat(liability.monthlyPayment)) : '—'}
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

            {/* Subtotal */}
            <div className="grid grid-cols-[1fr_150px_160px_120px_120px_80px] gap-3 px-3 py-2 border-t border-zinc-800 mt-1">
              <span className="text-xs text-zinc-500 font-semibold">
                Subtotal — {LIABILITY_TYPE_LABELS[type] ?? type}
              </span>
              <span />
              <span className="text-right font-mono text-sm font-semibold text-zinc-200">
                {formatINR(subtotal)}
              </span>
              <span />
              <span />
              <span />
            </div>

            <button
              onClick={() => setAddForType(type)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors px-3 py-1.5"
            >
              <Plus size={12} />
              Add {LIABILITY_TYPE_LABELS[type] ?? type}
            </button>
          </div>
        )
      })}

      {editLiability && (
        <AddLiabilityModal
          open
          liability={editLiability}
          onClose={() => setEditLiability(null)}
          onSave={async (data, id) => { await onAdd(data, id); setEditLiability(null) }}
        />
      )}
      {addForType && (
        <AddLiabilityModal
          open
          defaultType={addForType}
          onClose={() => setAddForType(null)}
          onSave={async (data) => { await onAdd(data); setAddForType(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Liability"
        description="This liability will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

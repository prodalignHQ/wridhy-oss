'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Transaction, Owner } from '@/lib/store/transactions.store'

interface SplitOwnerModalProps {
  open: boolean
  onClose: () => void
  transaction: Transaction | null
  owners: Owner[]
  onSave: (ownerIds: string[]) => Promise<void>
}

// ─── Color Pill ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

function OwnerInitialCircle({ owner }: { owner: Owner }) {
  const colorClass = COLOR_MAP[owner.color] ?? 'bg-zinc-500'
  const initials = owner.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0',
        colorClass
      )}
    >
      {initials}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SplitOwnerModal({
  open,
  onClose,
  transaction,
  owners,
  onSave,
}: SplitOwnerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  // Initialize with current owners when the transaction changes
  useEffect(() => {
    if (transaction) {
      const currentOwnerIds = transaction.transactionOwners.map((to) => to.ownerId)
      setSelectedIds(new Set(currentOwnerIds))
    }
  }, [transaction])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        // Don't allow deselecting the last owner
        if (next.size === 1) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!transaction) return
    setIsSaving(true)
    try {
      await onSave(Array.from(selectedIds))
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const txnAmount = transaction ? parseFloat(String(transaction.amount)) : 0
  const n = selectedIds.size
  const shareAmount = n > 0 ? txnAmount / n : 0

  const formatINR = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Assign Owners</DialogTitle>
          {transaction && (
            <p className="text-sm text-zinc-400 mt-1">
              <span className="font-mono font-semibold text-zinc-200">
                {formatINR(txnAmount)}
              </span>
              {' · '}
              <span className="truncate">
                {transaction.description.length > 40
                  ? transaction.description.slice(0, 40) + '…'
                  : transaction.description}
              </span>
            </p>
          )}
        </DialogHeader>

        {/* Owner checklist */}
        <div className="space-y-2 py-2">
          {owners.map((owner) => {
            const isSelected = selectedIds.has(owner.id)
            return (
              <button
                key={owner.id}
                onClick={() => toggle(owner.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 h-12 rounded-lg border transition-all text-left',
                  isSelected
                    ? 'bg-indigo-950 border-indigo-700 text-zinc-100'
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600'
                )}
              >
                <OwnerInitialCircle owner={owner} />
                <span className="flex-1 text-sm font-medium">{owner.name}</span>
                {/* Custom checkbox */}
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'
                  )}
                >
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Equal split summary */}
        {n > 1 && (
          <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-4 py-3 text-sm font-semibold text-emerald-400">
            Split equally — {formatINR(shareAmount)} each ({n} owners)
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedIds.size === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

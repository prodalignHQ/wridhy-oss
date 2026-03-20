'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { DepositModal } from '../modals/DepositModal'
import { formatINR } from '@/lib/format'

export interface DepositAsset {
  id: string
  name: string
  type: 'fixed_deposit' | 'recurring_deposit' | 'ppf'
  value: string // Present Value
  currency: string
  valuationDate: string
  metadata: {
    accountNumber?: string
    investedAmount?: number
    interestRate?: number
    maturityDate?: string
    maturityAmount?: number
    comments?: string
  }
}

interface DepositsTableProps {
  assets: DepositAsset[]
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const TYPE_LABELS: Record<string, string> = {
  fixed_deposit: 'FD',
  recurring_deposit: 'RD',
  ppf: 'PPF'
}

export function DepositsTable({ assets, onAdd, onDelete }: DepositsTableProps) {
  const [editAsset, setEditAsset] = useState<DepositAsset | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const subtotalPresent = assets.reduce((s, a) => s + parseFloat(a.value), 0)
  const subtotalInvested = assets.reduce((s, a) => s + (a.metadata.investedAmount || 0), 0)
  const totalEarned = subtotalPresent - subtotalInvested

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        <p>No deposits added (FDs, RDs, PPF).</p>
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 mx-auto"
        >
          <Plus size={12} /> Add Deposit
        </button>
        {isAdding && (
          <DepositModal
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
          Deposits & PPF
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={12} />
          Add Deposit
        </button>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold border-b border-border/50">
        <span>Name & Type</span>
        <span>Account / Rate</span>
        <span className="text-right">Invested</span>
        <span className="text-right">Present Value</span>
        <span className="text-right">Maturity Date</span>
        <span />
      </div>

      {assets.map((asset) => {
        const invested = asset.metadata.investedAmount || 0
        const present = parseFloat(asset.value)
        const earned = present - invested

        return (
          <div
            key={asset.id}
            className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] leading-none px-1.5 py-0.5 border-border ${
                asset.type === 'fixed_deposit' ? 'text-blue-400' :
                asset.type === 'recurring_deposit' ? 'text-amber-400' : 'text-purple-400'
              }`}>
                {TYPE_LABELS[asset.type] || asset.type}
              </Badge>
              <div className="flex flex-col">
                <span className="text-sm text-foreground/90">{asset.name}</span>
                {asset.metadata.comments && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{asset.metadata.comments}</span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-0.5 items-start">
              {asset.metadata.accountNumber ? (
                <span className="text-xs font-mono text-muted-foreground">{asset.metadata.accountNumber}</span>
              ) : (
                <span className="text-xs text-muted-foreground/70 italic">No A/c</span>
              )}
              {asset.metadata.interestRate ? (
                <span className="text-[10px] text-muted-foreground">{asset.metadata.interestRate}% Interest</span>
              ) : null}
            </div>

            <span className="text-right font-mono text-sm text-muted-foreground">
              {formatINR(invested)}
            </span>
            <div className="text-right flex flex-col">
               <span className="font-mono text-sm text-emerald-400">
                {formatINR(present)}
              </span>
              {earned > 0 && (
                <span className="text-[10px] text-emerald-500/70">
                  +{formatINR(earned)}
                </span>
              )}
            </div>
            <div className="text-right flex flex-col items-end">
              {asset.metadata.maturityDate ? (
                <>
                  <span className="text-sm text-foreground/80">
                    {new Date(asset.metadata.maturityDate).toLocaleDateString('en-IN', {
                      month: 'short', year: 'numeric'
                    })}
                  </span>
                  {asset.metadata.maturityAmount ? (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatINR(asset.metadata.maturityAmount)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-muted-foreground/70">—</span>
              )}
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

      {assets.length > 0 && (
        <div className="grid grid-cols-[1.5fr_1fr_120px_120px_120px_80px] gap-3 px-3 py-3 bg-card/50 rounded-b-lg border-t border-border mt-1">
          <span className="text-xs text-muted-foreground font-semibold flex items-center">
            Total Deposits
          </span>
          <span />
          <span className="text-right font-mono text-sm font-semibold text-foreground/80">
            {formatINR(subtotalInvested)}
          </span>
          <div className="text-right flex flex-col">
            <span className="font-mono text-sm font-semibold text-emerald-400">
              {formatINR(subtotalPresent)}
            </span>
            {totalEarned >= 0 && (
               <span className="text-[10px] font-semibold text-emerald-500/70">
                 +{formatINR(totalEarned)} earned
               </span>
            )}
          </div>
          <span />
          <span />
        </div>
      )}

      {isAdding && (
        <DepositModal
          open
          onClose={() => setIsAdding(false)}
          onSave={async (data: any) => { await onAdd(data); setIsAdding(false) }}
        />
      )}
      {editAsset && (
        <DepositModal
          open
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onSave={async (data: any, id?: string) => { await onAdd(data, id); setEditAsset(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(val) => !val && setDeleteId(null)}
        title="Delete Deposit"
        description="This asset will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={async () => { if (deleteId) await onDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}

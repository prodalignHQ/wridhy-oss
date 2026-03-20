'use client'

import { MutualFundsTable, MutualFundAsset } from './tables/MutualFundsTable'
import { StocksTable, StockAsset } from './tables/StocksTable'
import { DepositsTable, DepositAsset } from './tables/DepositsTable'
import { SavingsTable, SavingsAsset } from './tables/SavingsTable'
import { GenericAssetTable, GenericAsset } from './tables/GenericAssetTable'

interface AssetLayoutProps {
  assets: any[] // From API
  onAdd: (data: any, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function AssetLayout({ assets, onAdd, onDelete }: AssetLayoutProps) {
  // Partition assets into groups
  const mfAssets = assets.filter(a => a.type === 'mutual_fund') as MutualFundAsset[]
  const stockAssets = assets.filter(a => a.type === 'stock') as StockAsset[]
  const depositAssets = assets.filter(a => ['fixed_deposit', 'recurring_deposit', 'ppf'].includes(a.type)) as DepositAsset[]
  const savingsAssets = assets.filter(a => a.type === 'savings_account') as SavingsAsset[]
  const genericAssets = assets.filter(a => ['real_estate', 'crypto', 'cash', 'other'].includes(a.type)) as GenericAsset[]

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center justify-between">
            Assets Breakdown
            <span className="text-sm font-normal text-zinc-400">Total: {assets.length} items</span>
          </h2>
        </div>

        <div className="divide-y divide-zinc-800 space-y-4 pb-4">
          <div className="pt-2">
            <MutualFundsTable assets={mfAssets} onAdd={onAdd} onDelete={onDelete} />
          </div>
          <div className="pt-2">
            <StocksTable assets={stockAssets} onAdd={onAdd} onDelete={onDelete} />
          </div>
          <div className="pt-2">
            <DepositsTable assets={depositAssets} onAdd={onAdd} onDelete={onDelete} />
          </div>
          <div className="pt-2">
            <SavingsTable assets={savingsAssets} onAdd={onAdd} onDelete={onDelete} />
          </div>
          <div className="pt-2">
            <GenericAssetTable assets={genericAssets} onAdd={onAdd} onDelete={onDelete} />
          </div>
        </div>
      </div>
    </div>
  )
}

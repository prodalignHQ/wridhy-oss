'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, PlusCircle, Camera, FileEdit, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/custom/StatCard'
import { Button } from '@/components/ui/button'
import { AssetLayout } from '@/components/networth/AssetLayout'
import { LiabilityTable } from '@/components/networth/LiabilityTable'
import { NetWorthHistoryChart } from '@/components/networth/NetWorthHistoryChart'
import { CopyFromSnapshotMenu } from '@/components/networth/CopyFromSnapshotMenu'
import { QuickEntryMode } from '@/components/networth/QuickEntryMode'
import { AddLiabilityModal, type Liability } from '@/components/networth/AddLiabilityModal'

type Mode = 'detailed' | 'quick'

interface NetWorthData {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  assets: any[]
  liabilities: Liability[]
}

interface Snapshot {
  id: string
  snapshotDate: string
  totalAssets: string
  totalLiabilities: string
  netWorth: string
}

interface Draft {
  savedAt: string
  assetBreakdown?: any[]
  liabilityBreakdown?: any[]
}

export default function NetWorthPage() {
  const [mode, setMode] = useState<Mode>('detailed')
  const [data, setData] = useState<NetWorthData | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [addAsset, setAddAsset] = useState(false)
  const [addLiability, setAddLiability] = useState(false)
  const [draftDismissed, setDraftDismissed] = useState(false)

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [nw, hist, dr] = await Promise.all([
        apiClient.fetch<NetWorthData>('/v1/networth'),
        apiClient.fetch<Snapshot[]>('/v1/networth/history'),
        apiClient.fetch<Draft | null>('/v1/networth/draft').catch(() => null),
      ])
      setData(nw)
      setSnapshots(hist)
      setDraft(dr)
    } catch {
      toast.error('Failed to load net worth data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true)
    try {
      await apiClient.fetch('/v1/networth/snapshot', { method: 'POST' })
      const monthLabel = format(new Date(), 'MMMM yyyy')
      toast.success(`Snapshot saved for ${monthLabel}`)
      setDraft(null)
      setDraftDismissed(true)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save snapshot')
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleQuickSnapshot = async (totalAssets: number, totalLiabilities: number) => {
    // For quick entry mode, we don't have individual asset/liability rows — 
    // instead POST directly to snapshot with a synthetic single-asset representation.
    // We create one asset + one liability server-side before snapshotting:
    // Delete existing, create synthetic rows, then snapshot.
    setSavingSnapshot(true)
    try {
      // Clear existing rows
      if (data?.assets) {
        await Promise.all(
          data.assets.map((a) =>
            apiClient.fetch(`/v1/networth/assets/${a.id}`, { method: 'DELETE' })
          )
        )
      }
      if (data?.liabilities) {
        await Promise.all(
          data.liabilities.map((l) =>
            apiClient.fetch(`/v1/networth/liabilities/${l.id}`, { method: 'DELETE' })
          )
        )
      }
      // Create synthetic rows
      if (totalAssets > 0) {
        await apiClient.fetch('/v1/networth/assets', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Total Assets (Quick Entry)',
            type: 'other',
            value: totalAssets,
            currency: 'INR',
            valuationDate: new Date().toISOString().split('T')[0],
          }),
        })
      }
      if (totalLiabilities > 0) {
        await apiClient.fetch('/v1/networth/liabilities', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Total Liabilities (Quick Entry)',
            type: 'other',
            outstandingAmount: totalLiabilities,
          }),
        })
      }
      await apiClient.fetch('/v1/networth/snapshot', { method: 'POST' })
      const monthLabel = format(new Date(), 'MMMM yyyy')
      toast.success(`Snapshot saved for ${monthLabel}`)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save snapshot')
    } finally {
      setSavingSnapshot(false)
    }
  }

  // ─── Draft ─────────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      await apiClient.fetch('/v1/networth/draft', { method: 'PUT', body: JSON.stringify({}) })
      toast.success('Draft saved')
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleDiscardDraft = async () => {
    try {
      await apiClient.fetch('/v1/networth/draft', { method: 'DELETE' })
      setDraft(null)
      setDraftDismissed(true)
    } catch {
      // Ignore
    }
  }

  // ─── Assets ────────────────────────────────────────────────────────────────

  const handleSaveAsset = async (formData: any, id?: string) => {
    if (id) {
      await apiClient.fetch(`/v1/networth/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      })
      toast.success('Asset updated')
    } else {
      await apiClient.fetch('/v1/networth/assets', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      toast.success('Asset added')
    }
    await fetchAll()
  }

  const handleDeleteAsset = async (id: string) => {
    await apiClient.fetch(`/v1/networth/assets/${id}`, { method: 'DELETE' })
    toast.success('Asset removed')
    await fetchAll()
  }

  // ─── Liabilities ───────────────────────────────────────────────────────────

  const handleSaveLiability = async (formData: any, id?: string) => {
    if (id) {
      await apiClient.fetch(`/v1/networth/liabilities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      })
      toast.success('Liability updated')
    } else {
      await apiClient.fetch('/v1/networth/liabilities', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      toast.success('Liability added')
    }
    await fetchAll()
  }

  const handleDeleteLiability = async (id: string) => {
    await apiClient.fetch(`/v1/networth/liabilities/${id}`, { method: 'DELETE' })
    toast.success('Liability removed')
    await fetchAll()
  }

  // ─── Copy from snapshot ────────────────────────────────────────────────────

  const handleCopySnapshot = async (snapshotId: string) => {
    try {
      await apiClient.fetch(`/v1/networth/snapshot/${snapshotId}/copy`, { method: 'POST' })
      const snap = snapshots.find((s) => s.id === snapshotId)
      const label = snap ? format(new Date(snap.snapshotDate), 'MMMM yyyy') : 'previous snapshot'
      toast.success(`Loaded values from ${label}. Review and save when ready.`)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to copy snapshot')
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const totalAssets = data?.totalAssets ?? 0
  const totalLiabilities = data?.totalLiabilities ?? 0
  const netWorth = data?.netWorth ?? 0
  const isPositive = netWorth >= 0

  // Trend vs previous snapshot
  let trendValue: string | undefined
  let trendDir: 'up' | 'down' | 'neutral' | undefined
  if (snapshots.length >= 2) {
    const prev = parseFloat(snapshots[snapshots.length - 2].netWorth)
    const delta = netWorth - prev
    trendDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
    trendValue = `${delta >= 0 ? '+' : ''}${formatINR(delta)} from last snapshot`
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-zinc-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ─── Draft restore banner ─────────────────────────────────────── */}
      {draft && !draftDismissed && (
        <div className="flex items-center justify-between bg-amber-950 border border-amber-800 text-amber-200 text-sm px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <FileEdit size={15} className="shrink-0" />
            <span>
              You have an unsaved draft from{' '}
              <span className="font-semibold">
                {format(new Date(draft.savedAt), 'dd MMM yyyy, h:mm a')}
              </span>
              .
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDiscardDraft}
              className="text-xs text-amber-400 hover:text-amber-200 underline"
            >
              Discard
            </button>
            <button
              onClick={() => setDraftDismissed(true)}
              className="text-amber-500 hover:text-amber-200 ml-2"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold text-zinc-50">Net Worth</h1>

        <div className="flex items-center gap-3">
          {/* Copy from previous dropdown */}
          <CopyFromSnapshotMenu snapshots={snapshots} onCopy={handleCopySnapshot} />

          {/* Mode toggle */}
          <div className="rounded-full bg-zinc-800 p-1 flex items-center gap-0.5">
            {(['detailed', 'quick'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  mode === m
                    ? 'bg-zinc-600 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {m === 'detailed' ? 'Detailed' : 'Quick Entry'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'quick' ? (
        <QuickEntryMode onSaveSnapshot={handleQuickSnapshot} />
      ) : (
        <>
          {/* ─── Section A: Summary cards + Save buttons ──────────────── */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Total Assets"
                value={formatINR(totalAssets)}
                valueColor="green"
                icon={<TrendingUp size={16} />}
              />
              <StatCard
                label="Total Liabilities"
                value={formatINR(totalLiabilities)}
                valueColor="red"
              />
              <StatCard
                label="Net Worth"
                value={(isPositive ? '' : '−') + formatINR(Math.abs(netWorth))}
                valueColor={isPositive ? 'green' : 'red'}
                trend={trendDir}
                trendValue={trendValue}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="border-zinc-700 text-zinc-400 hover:text-zinc-50 gap-1.5"
              >
                {savingDraft ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileEdit size={13} />
                )}
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                className="bg-indigo-600 hover:bg-indigo-500 gap-1.5"
              >
                {savingSnapshot ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
                Save Snapshot
              </Button>
            </div>
          </div>

          {/* ─── Section B: Assets ────────────────────────────────────── */}
          <AssetLayout
            assets={data?.assets ?? []}
            onAdd={handleSaveAsset}
            onDelete={handleDeleteAsset}
          />

          {/* ─── Section C: Liabilities ───────────────────────────────── */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">Liabilities</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddLiability(true)}
                className="border-zinc-700 text-zinc-400 hover:text-zinc-50 gap-1.5"
              >
                <PlusCircle size={13} />
                Add Liability
              </Button>
            </div>
            <LiabilityTable
              liabilities={data?.liabilities ?? []}
              onAdd={handleSaveLiability}
              onDelete={handleDeleteLiability}
            />
          </div>

          {/* ─── Section D: History chart ─────────────────────────────── */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-zinc-100 mb-5">Net Worth Over Time</h2>
            <NetWorthHistoryChart snapshots={snapshots} />
          </div>
        </>
      )}

      {/* Global Add modals (for top-level buttons) */}
      {addLiability && (
        <AddLiabilityModal
          open
          onClose={() => setAddLiability(false)}
          onSave={async (data, id) => { await handleSaveLiability(data, id); setAddLiability(false) }}
        />
      )}
    </div>
  )
}

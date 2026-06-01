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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

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
  ownerId?: string | null
  owner?: {
    id: string
    name: string
    color: string
  } | null
}

interface Draft {
  savedAt: string
  assetBreakdown?: any[]
  liabilityBreakdown?: any[]
}

interface Owner {
  id: string
  name: string
  notes: string | null
  color: string
  isDefault: boolean
}

export default function NetWorthPage() {
  const [mode, setMode] = useState<Mode>('detailed')
  const [data, setData] = useState<NetWorthData | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [addAsset, setAddAsset] = useState(false)
  const [addLiability, setAddLiability] = useState(false)
  const [draftDismissed, setDraftDismissed] = useState(false)
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState('')
  const [quickEntryValues, setQuickEntryValues] = useState<{ assets: number; liabilities: number } | null>(null)

  const defaultOwnerId = owners.find(o => o.isDefault)?.id

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const ownerQuery = selectedOwnerId && selectedOwnerId !== 'all' ? `?ownerId=${selectedOwnerId}` : ''
      const [nw, hist, dr, ownList] = await Promise.all([
        apiClient.fetch<NetWorthData>(`/v1/networth${ownerQuery}`),
        apiClient.fetch<Snapshot[]>(`/v1/networth/history${ownerQuery}`),
        apiClient.fetch<Draft | null>(`/v1/networth/draft${ownerQuery}`).catch(() => null),
        apiClient.fetch<Owner[]>('/v1/owners'),
      ])
      setData(nw)
      setSnapshots(hist)
      setDraft(dr)
      setOwners(ownList)
    } catch {
      toast.error('Failed to load net worth data')
    } finally {
      setLoading(false)
    }
  }, [selectedOwnerId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  const handleSaveSnapshot = async (date?: string) => {
    setSavingSnapshot(true)
    try {
      const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
      await apiClient.fetch('/v1/networth/snapshot', { 
        method: 'POST',
        body: JSON.stringify({ ownerId: targetOwnerId, date })
      })
      const dateLabel = format(date ? new Date(date) : new Date(), 'dd MMM yyyy')
      toast.success(`Snapshot saved for ${dateLabel}`)
      setDraft(null)
      setDraftDismissed(true)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save snapshot')
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleQuickSnapshot = async (totalAssets: number, totalLiabilities: number, date?: string) => {
    setSavingSnapshot(true)
    try {
      const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
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
            valuationDate: date || new Date().toISOString().split('T')[0],
            ownerId: targetOwnerId,
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
            ownerId: targetOwnerId,
          }),
        })
      }
      await apiClient.fetch('/v1/networth/snapshot', {
        method: 'POST',
        body: JSON.stringify({ ownerId: targetOwnerId, date })
      })
      const dateLabel = format(date ? new Date(date) : new Date(), 'dd MMM yyyy')
      toast.success(`Snapshot saved for ${dateLabel}`)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save snapshot')
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleConfirmSaveSnapshot = async () => {
    setSnapshotDialogOpen(false)
    if (quickEntryValues) {
      await handleQuickSnapshot(quickEntryValues.assets, quickEntryValues.liabilities, selectedSnapshotDate)
    } else {
      await handleSaveSnapshot(selectedSnapshotDate)
    }
  }

  // ─── Draft ─────────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
      await apiClient.fetch(`/v1/networth/draft?ownerId=${targetOwnerId}`, { method: 'PUT', body: JSON.stringify({}) })
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
      const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
      await apiClient.fetch(`/v1/networth/draft?ownerId=${targetOwnerId}`, { method: 'DELETE' })
      setDraft(null)
      setDraftDismissed(true)
    } catch {
      // Ignore
    }
  }

  // ─── Assets ────────────────────────────────────────────────────────────────

  const handleSaveAsset = async (formData: any, id?: string) => {
    const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
    const payload = {
      ...formData,
      ownerId: formData.ownerId || targetOwnerId,
    }

    if (id) {
      await apiClient.fetch(`/v1/networth/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      toast.success('Asset updated')
    } else {
      await apiClient.fetch('/v1/networth/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
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
    const targetOwnerId = selectedOwnerId && selectedOwnerId !== 'all' ? selectedOwnerId : defaultOwnerId
    const payload = {
      ...formData,
      ownerId: formData.ownerId || targetOwnerId,
    }

    if (id) {
      await apiClient.fetch(`/v1/networth/liabilities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      toast.success('Liability updated')
    } else {
      await apiClient.fetch('/v1/networth/liabilities', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  const contextOwners = selectedOwnerId === 'all' ? owners : owners.filter(o => o.id === selectedOwnerId)
  const contextDefaultOwnerId = selectedOwnerId === 'all' ? defaultOwnerId : selectedOwnerId

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
        <Loader2 className="animate-spin text-muted-foreground/70" size={32} />
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
        <h1 className="text-2xl font-semibold text-foreground">Net Worth</h1>

        <div className="flex items-center gap-3">
          {/* Member selector */}
          {owners.length > 0 && (
            <Select value={selectedOwnerId} onValueChange={(val) => setSelectedOwnerId(val ?? 'all')}>
              <SelectTrigger className="w-[180px] bg-secondary border-none rounded-full h-[38px] text-sm focus:ring-0">
                <SelectValue>
                  {selectedOwnerId === 'all'
                    ? 'All Household'
                    : owners.find((o) => o.id === selectedOwnerId)?.name || 'Select Member'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Household</SelectItem>
                {owners.map(owner => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name} {owner.isDefault ? '(Self)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Copy from previous dropdown */}
          <CopyFromSnapshotMenu snapshots={snapshots} onCopy={handleCopySnapshot} />

          {/* Mode toggle */}
          <div className="rounded-full bg-muted p-1 flex items-center gap-0.5">
            {(['detailed', 'quick'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  mode === m
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground/90'
                )}
              >
                {m === 'detailed' ? 'Detailed' : 'Quick Entry'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'quick' ? (
        <QuickEntryMode onSaveSnapshot={async (assets, liabilities) => {
          setQuickEntryValues({ assets, liabilities })
          setSelectedSnapshotDate(new Date().toISOString().split('T')[0])
          setSnapshotDialogOpen(true)
        }} />
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
                className="border-border text-muted-foreground hover:text-foreground gap-1.5"
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
                onClick={() => {
                  setQuickEntryValues(null)
                  setSelectedSnapshotDate(new Date().toISOString().split('T')[0])
                  setSnapshotDialogOpen(true)
                }}
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
            owners={contextOwners}
            defaultOwnerId={contextDefaultOwnerId}
          />

          {/* ─── Section C: Liabilities ───────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Liabilities</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddLiability(true)}
                className="border-border text-muted-foreground hover:text-foreground gap-1.5"
              >
                <PlusCircle size={13} />
                Add Liability
              </Button>
            </div>
            <LiabilityTable
              liabilities={data?.liabilities ?? []}
              onAdd={handleSaveLiability}
              onDelete={handleDeleteLiability}
              owners={contextOwners}
              defaultOwnerId={contextDefaultOwnerId}
            />
          </div>

          {/* ─── Section D: History chart ─────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-5">Net Worth Over Time</h2>
            <NetWorthHistoryChart snapshots={snapshots} owners={owners} selectedOwnerId={selectedOwnerId} />
          </div>
        </>
      )}

      {/* Global Add modals (for top-level buttons) */}
      {addLiability && (
        <AddLiabilityModal
          open
          owners={contextOwners}
          defaultOwnerId={contextDefaultOwnerId}
          onClose={() => setAddLiability(false)}
          onSave={async (data, id) => { await handleSaveLiability(data, id); setAddLiability(false) }}
        />
      )}

      {/* Save Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Save Snapshot</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose the date for this net worth snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-date" className="text-foreground">Snapshot Date</Label>
              <Input
                id="snapshot-date"
                type="date"
                value={selectedSnapshotDate}
                onChange={(e) => setSelectedSnapshotDate(e.target.value)}
                className="bg-background border-border focus-visible:ring-indigo-500 text-foreground"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSnapshotDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSaveSnapshot}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

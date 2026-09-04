'use client'

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { TrendingUp, PlusCircle, Camera, FileEdit, X, Loader2, Trash2, Eye, CalendarClock, History, Check, Users, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText } from 'lucide-react'
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
import { NetWorthAllocation } from '@/components/networth/NetWorthAllocation'
import { AddLiabilityModal, type Liability } from '@/components/networth/AddLiabilityModal'
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog'
import { resolveAssetTag } from '@momoney/utils'
import { exportNetWorthPdf, exportNetWorthCsv } from '@/lib/networth-export'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
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
  assetBreakdown?: Array<{ name: string; type: string; value: number; equityDebtTag?: string; metadata?: any }> | null
  liabilityBreakdown?: Array<{ name: string; type: string; amount: number; interestRate?: number; monthlyPayment?: number }> | null
}

interface AggregatedSnapshotGroup {
  dateKey: string
  date: Date
  snapshots: Snapshot[]
  totalAssets: number
  totalLiabilities: number
  netWorth: number
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

const colorMap: Record<string, string> = {
  indigo: 'bg-primary/10 text-primary border-primary/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

const AVATAR_COLOR_MAP: Record<string, string> = {
  indigo: 'bg-primary',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [addAsset, setAddAsset] = useState(false)
  const [addLiability, setAddLiability] = useState(false)
  const [draftDismissed, setDraftDismissed] = useState(false)
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState('')

  const [detailsSnapshot, setDetailsSnapshot] = useState<Snapshot | null>(null)
  const [deleteSnapshotId, setDeleteSnapshotId] = useState<string | null>(null)
  const [restoreSnapshotId, setRestoreSnapshotId] = useState<string | null>(null)
  const [isEditingValues, setIsEditingValues] = useState(false)
  const [expandedDates, setExpandedDates] = useState<string[]>([])
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const isAllSelected = selectedOwnerIds.length === 0 || (owners.length > 0 && selectedOwnerIds.length === owners.length)
  const isSingleOwner = selectedOwnerIds.length === 1
  const singleOwnerId = isSingleOwner ? selectedOwnerIds[0] : null
  const defaultOwnerId = owners.find(o => o.isDefault)?.id
  const targetOwnerId = singleOwnerId || defaultOwnerId

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const ownerQuery = isAllSelected ? '' : `?ownerIds=${selectedOwnerIds.join(',')}`
      const singleQuery = singleOwnerId ? `?ownerId=${singleOwnerId}` : (defaultOwnerId ? `?ownerId=${defaultOwnerId}` : '')

      const [nw, hist, dr, ownList] = await Promise.all([
        apiClient.fetch<NetWorthData>(`/v1/networth${ownerQuery}`),
        apiClient.fetch<Snapshot[]>(`/v1/networth/history${ownerQuery}`),
        apiClient.fetch<Draft | null>(`/v1/networth/draft${singleQuery}`).catch(() => null),
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
  }, [isAllSelected, selectedOwnerIds, singleOwnerId, defaultOwnerId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Aggregated Snapshot Groups ────────────────────────────────────────────

  const aggregatedSnapshotGroups: AggregatedSnapshotGroup[] = useMemo(() => {
    const groups: Record<string, Snapshot[]> = {}
    
    for (const snap of snapshots) {
      const d = new Date(snap.snapshotDate)
      const dateKey = format(d, 'yyyy-MM-dd')
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(snap)
    }

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        const snaps = groups[dateKey]!
        const totalAssets = snaps.reduce((sum, s) => sum + parseFloat(s.totalAssets || '0'), 0)
        const totalLiabilities = snaps.reduce((sum, s) => sum + parseFloat(s.totalLiabilities || '0'), 0)
        const netWorth = totalAssets - totalLiabilities
        return {
          dateKey,
          date: new Date(snaps[0]!.snapshotDate),
          snapshots: snaps,
          totalAssets,
          totalLiabilities,
          netWorth,
        }
      })
  }, [snapshots])

  const toggleExpandDate = (dateKey: string) => {
    setExpandedDates((prev) =>
      prev.includes(dateKey) ? prev.filter((d) => d !== dateKey) : [...prev, dateKey]
    )
  }

  const toggleExpandAll = () => {
    if (expandedDates.length === aggregatedSnapshotGroups.length) {
      setExpandedDates([])
    } else {
      setExpandedDates(aggregatedSnapshotGroups.map((g) => g.dateKey))
    }
  }

  // ─── Filter Chip Handlers ──────────────────────────────────────────────────

  const handleSelectAll = () => {
    setSelectedOwnerIds([])
  }

  const handleToggleOwner = (ownerId: string) => {
    if (isAllSelected) {
      setSelectedOwnerIds([ownerId])
    } else if (selectedOwnerIds.includes(ownerId)) {
      if (selectedOwnerIds.length === 1) {
        setSelectedOwnerIds([])
      } else {
        setSelectedOwnerIds(selectedOwnerIds.filter((id) => id !== ownerId))
      }
    } else {
      const next = [...selectedOwnerIds, ownerId]
      if (next.length === owners.length) {
        setSelectedOwnerIds([])
      } else {
        setSelectedOwnerIds(next)
      }
    }
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  const handleSaveSnapshot = async (date?: string) => {
    setSavingSnapshot(true)
    try {
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

  const handleConfirmSaveSnapshot = async () => {
    setSnapshotDialogOpen(false)
    await handleSaveSnapshot(selectedSnapshotDate)
  }

  // ─── Draft ─────────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
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
      await apiClient.fetch(`/v1/networth/draft?ownerId=${targetOwnerId}`, { method: 'DELETE' })
      setDraft(null)
      setDraftDismissed(true)
    } catch {
      // Ignore
    }
  }

  // ─── Assets ────────────────────────────────────────────────────────────────

  const handleSaveAsset = async (formData: any, id?: string) => {
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

  const handleCopySnapshot = async (snapshotId: string, adjustedData?: { adjustedAssets: any[], adjustedLiabilities: any[] }) => {
    try {
      await apiClient.fetch(`/v1/networth/snapshot/${snapshotId}/copy`, {
        method: 'POST',
        body: adjustedData ? JSON.stringify(adjustedData) : undefined
      })
      const snap = snapshots.find((s) => s.id === snapshotId)
      const label = snap ? format(new Date(snap.snapshotDate), 'MMMM yyyy') : 'previous snapshot'
      toast.success(`Loaded values from ${label}. Review and save when ready.`)
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to copy snapshot')
    }
  }

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await apiClient.fetch(`/v1/networth/snapshot/${snapshotId}`, { method: 'DELETE' })
      toast.success('Snapshot deleted successfully')
      await fetchAll()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete snapshot')
    }
  }

  // ─── Export handlers ───────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!data) return
    setExportingPdf(true)
    try {
      toast.loading('Generating Net Worth PDF Statement...', { id: 'export-pdf' })
      await exportNetWorthPdf({
        data,
        owners,
        selectedOwnerIds,
        isAllSelected,
        snapshots,
        statementDate: new Date(),
      })
      toast.success('PDF statement downloaded successfully', { id: 'export-pdf' })
    } catch (err: any) {
      console.error('PDF export error:', err)
      toast.error('Failed to generate PDF statement', { id: 'export-pdf' })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportCsv = () => {
    if (!data) return
    setExportingCsv(true)
    try {
      exportNetWorthCsv({
        data,
        owners,
        selectedOwnerIds,
        isAllSelected,
        statementDate: new Date(),
      })
      toast.success('CSV spreadsheet downloaded successfully')
    } catch (err: any) {
      console.error('CSV export error:', err)
      toast.error('Failed to export CSV')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleExportSnapshotPdf = async (snap: Snapshot) => {
    try {
      toast.loading('Generating Snapshot PDF Statement...', { id: 'snap-pdf' })
      const snapAssets = (snap.assetBreakdown || []).map(a => ({
        ...a,
        value: String(a.value),
        ownerId: a.metadata?.ownerId || snap.ownerId,
      }))
      const snapLiabs = (snap.liabilityBreakdown || []).map(l => ({
        ...l,
        outstandingAmount: l.amount,
        ownerId: snap.ownerId,
      }))
      const snapOwnerIds = snap.ownerId ? [snap.ownerId] : []

      await exportNetWorthPdf({
        data: {
          totalAssets: parseFloat(snap.totalAssets || '0'),
          totalLiabilities: parseFloat(snap.totalLiabilities || '0'),
          netWorth: parseFloat(snap.netWorth || '0'),
          assets: snapAssets,
          liabilities: snapLiabs,
        },
        owners,
        selectedOwnerIds: snapOwnerIds,
        isAllSelected: snapOwnerIds.length === 0,
        statementDate: new Date(snap.snapshotDate),
      })
      toast.success('Snapshot PDF downloaded successfully', { id: 'snap-pdf' })
    } catch (err: any) {
      console.error('Snapshot PDF export error:', err)
      toast.error('Failed to generate snapshot PDF', { id: 'snap-pdf' })
    }
  }

  const handleExportSnapshotCsv = (snap: Snapshot) => {
    try {
      const snapAssets = (snap.assetBreakdown || []).map(a => ({
        ...a,
        value: String(a.value),
        ownerId: a.metadata?.ownerId || snap.ownerId,
      }))
      const snapLiabs = (snap.liabilityBreakdown || []).map(l => ({
        ...l,
        outstandingAmount: l.amount,
        ownerId: snap.ownerId,
      }))
      const snapOwnerIds = snap.ownerId ? [snap.ownerId] : []

      exportNetWorthCsv({
        data: {
          totalAssets: parseFloat(snap.totalAssets || '0'),
          totalLiabilities: parseFloat(snap.totalLiabilities || '0'),
          netWorth: parseFloat(snap.netWorth || '0'),
          assets: snapAssets,
          liabilities: snapLiabs,
        },
        owners,
        selectedOwnerIds: snapOwnerIds,
        isAllSelected: snapOwnerIds.length === 0,
        statementDate: new Date(snap.snapshotDate),
      })
      toast.success('Snapshot CSV downloaded successfully')
    } catch (err: any) {
      console.error('Snapshot CSV export error:', err)
      toast.error('Failed to export snapshot CSV')
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const contextOwners = isAllSelected ? owners : owners.filter(o => selectedOwnerIds.includes(o.id))
  const contextDefaultOwnerId = (isSingleOwner ? singleOwnerId : defaultOwnerId) ?? undefined

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

  // ─── Unsaved snapshot detection ────────────────────────────────────────────
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const currentMonthStr = format(new Date(), 'yyyy-MM')
  const latestSnapshotMonthStr = latestSnapshot ? format(new Date(latestSnapshot.snapshotDate), 'yyyy-MM') : ''
  const isCurrentMonthSaved = latestSnapshotMonthStr === currentMonthStr

  const liveTotalAssets = data?.totalAssets ?? 0
  const liveTotalLiabilities = data?.totalLiabilities ?? 0

  const latestSnapshotAssets = latestSnapshot ? parseFloat(latestSnapshot.totalAssets) : 0
  const latestSnapshotLiabilities = latestSnapshot ? parseFloat(latestSnapshot.totalLiabilities) : 0

  // Check if live values differ from latest snapshot
  const valuesDiffer =
    Math.abs(liveTotalAssets - latestSnapshotAssets) > 0.01 ||
    Math.abs(liveTotalLiabilities - latestSnapshotLiabilities) > 0.01

  const isSnapshotUnsaved = isSingleOwner && (!latestSnapshot || !isCurrentMonthSaved || valuesDiffer)

  let unsavedReason = ''
  if (isSingleOwner) {
    if (!latestSnapshot) {
      unsavedReason = 'No snapshots saved yet'
    } else if (!isCurrentMonthSaved) {
      unsavedReason = `No snapshot saved for ${format(new Date(), 'MMMM yyyy')} yet`
    } else if (valuesDiffer) {
      unsavedReason = 'Live values differ from your last saved snapshot'
    }
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
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Net Worth</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track and aggregate assets and liabilities across your household
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Member filter chips */}
          {owners.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap bg-card/60 border border-border p-1.5 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                  isAllSelected
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Users size={13} className={isAllSelected ? 'text-white' : 'text-muted-foreground'} />
                <span>All Household</span>
              </button>

              <div className="h-4 w-px bg-border/80 mx-0.5" />

              {owners.map((owner) => {
                const isSelected = !isAllSelected && selectedOwnerIds.includes(owner.id)
                const initials = owner.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                const avatarBg = AVATAR_COLOR_MAP[owner.color] ?? 'bg-primary'

                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => handleToggleOwner(owner.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border',
                      isSelected
                        ? 'border-primary/80 bg-primary/15 text-foreground ring-1 ring-primary/30 font-semibold'
                        : isAllSelected
                        ? 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        : 'border-transparent text-muted-foreground/60 opacity-60 hover:opacity-100 hover:text-foreground hover:bg-muted/40'
                    )}
                  >
                    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0', avatarBg)}>
                      {initials}
                    </span>
                    <span>{owner.name}</span>
                    {owner.isDefault && (
                      <span className="text-[10px] text-muted-foreground font-normal">(Self)</span>
                    )}
                    {isSelected && (
                      <Check size={12} className="text-primary ml-0.5 stroke-[2.5]" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!data || loading}
              className="inline-flex items-center justify-center h-10 px-3.5 rounded-2xl border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1.5 shadow-sm font-medium text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {exportingPdf ? (
                <Loader2 size={13} className="animate-spin text-primary" />
              ) : (
                <Download size={13} />
              )}
              <span>Export</span>
              <ChevronDown size={11} className="opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-xl p-1 rounded-xl">
              <DropdownMenuItem
                onClick={handleExportPdf}
                disabled={exportingPdf || !data}
                className="cursor-pointer gap-2.5 p-2 rounded-lg hover:bg-muted/80 focus:bg-muted/80"
              >
                <FileText size={15} className="text-primary shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-foreground text-xs">Export PDF</span>
                  <span className="text-[10px] text-muted-foreground">Multi-page styled statement</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportCsv}
                disabled={exportingCsv || !data}
                className="cursor-pointer gap-2.5 p-2 rounded-lg hover:bg-muted/80 focus:bg-muted/80"
              >
                <FileSpreadsheet size={15} className="text-emerald-400 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-foreground text-xs">Export CSV</span>
                  <span className="text-[10px] text-muted-foreground">Data spreadsheet (.csv)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
            <div className="flex items-center gap-3 justify-end flex-wrap">
              {isSingleOwner && isSnapshotUnsaved && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-auto animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Unsaved Snapshot: {unsavedReason}</span>
                </div>
              )}
              {isSingleOwner ? (
                <>
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
                    variant={isEditingValues ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditingValues(!isEditingValues)}
                    className={cn(
                      "gap-1.5 transition-colors",
                      isEditingValues
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-none"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isEditingValues ? <Check size={13} /> : <FileEdit size={13} />}
                    {isEditingValues ? 'Finish Editing' : 'Edit Values'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedSnapshotDate(new Date().toISOString().split('T')[0])
                      setSnapshotDialogOpen(true)
                    }}
                    disabled={savingSnapshot}
                    className="bg-primary hover:bg-primary gap-1.5"
                  >
                    {savingSnapshot ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Camera size={13} />
                    )}
                    Save Snapshot
                  </Button>
                </>
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 bg-secondary/40 border border-border/50 px-4 py-2 rounded-lg w-full justify-between">
                    <span>
                      💡 {isAllSelected ? (
                        <><strong>All Household</strong> view is aggregated across all members.</>
                      ) : (
                        <>Aggregated view across <strong>{selectedOwnerIds.length} selected members</strong>.</>
                      )} Select a single member chip to edit values, save drafts, or save snapshots.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Section: Asset Allocation (Equity, Debt, Cash) ─────────── */}
            <NetWorthAllocation
              assets={data?.assets ?? []}
              totalAssets={totalAssets}
              netWorth={netWorth}
            />

            {/* ─── Section B: Assets ────────────────────────────────────── */}
            <AssetLayout
              assets={data?.assets ?? []}
              onAdd={handleSaveAsset}
              onDelete={handleDeleteAsset}
              owners={owners}
              defaultOwnerId={contextDefaultOwnerId}
              inlineEdit={isEditingValues}
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
                owners={owners}
                defaultOwnerId={contextDefaultOwnerId}
                inlineEdit={isEditingValues}
              />
            </div>

            {/* ─── Section D: History chart ─────────────────────────────── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-5">Net Worth Over Time</h2>
              <NetWorthHistoryChart snapshots={snapshots} owners={owners} selectedOwnerIds={selectedOwnerIds} />
            </div>

            {/* ─── Section E: Snapshot History Table ─────────────────────────── */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Snapshot History</h2>
                  <span className="text-xs text-muted-foreground">
                    {!isSingleOwner
                      ? `${aggregatedSnapshotGroups.length} snapshot period${aggregatedSnapshotGroups.length === 1 ? '' : 's'} (${snapshots.length} total record${snapshots.length === 1 ? '' : 's'})`
                      : `${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} recorded`}
                  </span>
                </div>
                {!isSingleOwner && aggregatedSnapshotGroups.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleExpandAll}
                    className="text-xs text-muted-foreground hover:text-foreground h-7"
                  >
                    {expandedDates.length === aggregatedSnapshotGroups.length ? 'Collapse All' : 'Expand All'}
                  </Button>
                )}
              </div>

              {snapshots.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  No saved snapshots found.
                </div>
              ) : isSingleOwner ? (
                /* Single owner table */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs uppercase bg-muted/30 border-b border-border/50 text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Assets</th>
                        <th className="px-4 py-3 text-right">Liabilities</th>
                        <th className="px-4 py-3 text-right">Net Worth</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {[...snapshots].reverse().map((snap) => {
                        const snapDate = new Date(snap.snapshotDate)
                        const nwVal = parseFloat(snap.netWorth)

                        return (
                          <tr key={snap.id} className="hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
                            <td className="px-4 py-3 text-foreground font-medium">
                              {format(snapDate, 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-400">
                              {formatINR(parseFloat(snap.totalAssets))}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-rose-400">
                              {formatINR(parseFloat(snap.totalLiabilities))}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">
                              {nwVal >= 0 ? '' : '−'}{formatINR(Math.abs(nwVal))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setDetailsSnapshot(snap)}
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                                
                                {singleOwnerId === snap.ownerId && (
                                  <button
                                    onClick={() => setRestoreSnapshotId(snap.id)}
                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                                    title="Restore snapshot to live draft"
                                  >
                                    <CalendarClock size={14} />
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => setDeleteSnapshotId(snap.id)}
                                  className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-muted rounded transition-colors"
                                  title="Delete Snapshot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Aggregated table with expandable rows */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs uppercase bg-muted/30 border-b border-border/50 text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Members</th>
                        <th className="px-4 py-3 text-right">Assets</th>
                        <th className="px-4 py-3 text-right">Liabilities</th>
                        <th className="px-4 py-3 text-right">Net Worth</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {aggregatedSnapshotGroups.map((group) => {
                        const isExpanded = expandedDates.includes(group.dateKey)
                        const nwVal = group.netWorth

                        return (
                          <Fragment key={group.dateKey}>
                            {/* Aggregated parent row */}
                            <tr
                              onClick={() => toggleExpandDate(group.dateKey)}
                              className={cn(
                                "cursor-pointer transition-colors border-b border-border/30",
                                isExpanded ? "bg-muted/40 font-medium" : "hover:bg-muted/20"
                              )}
                            >
                              <td className="px-4 py-3 text-foreground font-medium flex items-center gap-2">
                                <div className="p-1 rounded hover:bg-muted text-muted-foreground">
                                  {isExpanded ? (
                                    <ChevronDown size={15} className="text-primary" />
                                  ) : (
                                    <ChevronRight size={15} />
                                  )}
                                </div>
                                <span>{format(group.date, 'dd MMM yyyy')}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-foreground/90 mr-1">
                                    {group.snapshots.length} member{group.snapshots.length === 1 ? '' : 's'}
                                  </span>
                                  {group.snapshots.map((s) => {
                                    const owner = owners.find(o => o.id === s.ownerId)
                                    if (!owner) return null
                                    const initials = owner.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                                    const avatarBg = AVATAR_COLOR_MAP[owner.color] ?? 'bg-primary'
                                    return (
                                      <span
                                        key={s.id}
                                        title={owner.name}
                                        className={cn(
                                          "w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0",
                                          avatarBg
                                        )}
                                      >
                                        {initials}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-400 font-medium">
                                {formatINR(group.totalAssets)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-rose-400 font-medium">
                                {formatINR(group.totalLiabilities)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-foreground font-bold">
                                {nwVal >= 0 ? '' : '−'}{formatINR(Math.abs(nwVal))}
                              </td>
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpandDate(group.dateKey)}
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                >
                                  {isExpanded ? 'Hide' : 'Breakdown'}
                                  <ChevronDown size={13} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                                </Button>
                              </td>
                            </tr>

                            {/* Sub-rows for each member in this date group */}
                            {isExpanded && group.snapshots.map((snap) => {
                              const owner = owners.find(o => o.id === snap.ownerId)
                              const subNw = parseFloat(snap.netWorth)

                              return (
                                <tr
                                  key={snap.id}
                                  className="bg-muted/15 border-b border-border/20 last:border-b-0 hover:bg-muted/25 transition-colors text-xs"
                                >
                                  <td className="px-4 py-2.5 pl-10 text-muted-foreground flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-border" />
                                    <span>Individual snapshot</span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {owner ? (
                                      <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium", colorMap[owner.color] || "bg-primary/10 text-primary border-primary/20")}>
                                        <span className={cn("w-2 h-2 rounded-full", AVATAR_COLOR_MAP[owner.color] || "bg-primary")} />
                                        {owner.name} {owner.isDefault ? '(Self)' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/60">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400/90">
                                    {formatINR(parseFloat(snap.totalAssets))}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-rose-400/90">
                                    {formatINR(parseFloat(snap.totalLiabilities))}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">
                                    {subNw >= 0 ? '' : '−'}{formatINR(Math.abs(subNw))}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => setDetailsSnapshot(snap)}
                                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                        title="View Member Snapshot Details"
                                      >
                                        <Eye size={13} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteSnapshotId(snap.id)}
                                        className="p-1 text-muted-foreground hover:text-rose-400 hover:bg-muted rounded transition-colors"
                                        title="Delete Snapshot"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

        {/* Global Add modals (for top-level buttons) */}
        {addLiability && (
          <AddLiabilityModal
            open
            owners={owners}
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
                  className="bg-background border-border focus-visible:ring-primary text-foreground"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setSnapshotDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSaveSnapshot}
                className="bg-primary hover:bg-primary text-white"
              >
                Save Snapshot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Snapshot Details Dialog */}
        <Dialog open={!!detailsSnapshot} onOpenChange={(val) => !val && setDetailsSnapshot(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center justify-between">
                <span>Snapshot Details</span>
                {detailsSnapshot && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {format(new Date(detailsSnapshot.snapshotDate), 'dd MMM yyyy')}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {detailsSnapshot?.owner && (
                  <span>Member: <strong>{detailsSnapshot.owner.name}</strong></span>
                )}
              </DialogDescription>
            </DialogHeader>

            {detailsSnapshot && (
              <div className="space-y-6 py-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-secondary/45 border border-border/40 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Assets</p>
                    <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
                      {formatINR(parseFloat(detailsSnapshot.totalAssets))}
                    </p>
                  </div>
                  <div className="bg-secondary/45 border border-border/40 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Liabilities</p>
                    <p className="text-lg font-bold font-mono text-rose-400 mt-1">
                      {formatINR(parseFloat(detailsSnapshot.totalLiabilities))}
                    </p>
                  </div>
                  <div className="bg-secondary/45 border border-border/40 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Net Worth</p>
                    <p className="text-lg font-bold font-mono text-foreground mt-1">
                      {parseFloat(detailsSnapshot.netWorth) >= 0 ? '' : '−'}
                      {formatINR(Math.abs(parseFloat(detailsSnapshot.netWorth)))}
                    </p>
                  </div>
                </div>

                {/* Equity / Debt / Mixed / Cash / Liability Split */}
                {(() => {
                  const totalAssetsVal = parseFloat(detailsSnapshot.totalAssets)
                  const totalLiabilitiesVal = parseFloat(detailsSnapshot.totalLiabilities)
                  const safeAssets = totalAssetsVal > 0 ? totalAssetsVal : 1

                  let equityTotal = 0
                  let debtTotal = 0
                  let mixedTotal = 0
                  let cashTotal = 0

                  detailsSnapshot.assetBreakdown?.forEach((a) => {
                    const tag = resolveAssetTag(a.type, a.metadata, a.equityDebtTag)
                    if (tag === 'equity') equityTotal += a.value
                    else if (tag === 'debt') debtTotal += a.value
                    else if (tag === 'cash') cashTotal += a.value
                    else if (tag === 'mixed') mixedTotal += a.value
                  })

                  const splits = [
                    { label: 'Equity', value: equityTotal, color: 'text-primary', bg: 'bg-primary' },
                    { label: 'Debt', value: debtTotal, color: 'text-amber-400', bg: 'bg-amber-500' },
                    { label: 'Cash', value: cashTotal, color: 'text-emerald-400', bg: 'bg-emerald-500' },
                    ...(mixedTotal > 0 ? [{ label: 'Mixed', value: mixedTotal, color: 'text-purple-400', bg: 'bg-purple-500' }] : []),
                    ...(totalLiabilitiesVal > 0 ? [{ label: 'Liabilities', value: totalLiabilitiesVal, color: 'text-rose-400', bg: 'bg-rose-500' }] : []),
                  ]

                  const maxSplitVal = Math.max(...splits.map(s => s.value), 1)

                  return (
                    <div className="bg-secondary/45 border border-border/40 p-4 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Asset Allocation Split</p>
                        <span className="text-xs text-muted-foreground">
                          {((equityTotal / safeAssets) * 100).toFixed(0)}% Equity · {((debtTotal / safeAssets) * 100).toFixed(0)}% Debt · {((cashTotal / safeAssets) * 100).toFixed(0)}% Cash
                        </span>
                      </div>
                      <div className="space-y-2">
                        {splits.filter(s => s.value > 0).map((split) => {
                          const pctOfAssets = split.label !== 'Liabilities' && totalAssetsVal > 0 ? (split.value / totalAssetsVal) * 100 : undefined
                          const barWidth = maxSplitVal > 0 ? (split.value / maxSplitVal) * 100 : 0
                          return (
                            <div key={split.label} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-medium">{split.label}</span>
                                <span className={`font-mono ${split.color} font-semibold`}>
                                  {formatINR(split.value)}{' '}
                                  {pctOfAssets !== undefined && (
                                    <span className="text-muted-foreground font-normal">({pctOfAssets.toFixed(1)}% of assets)</span>
                                  )}
                                </span>
                              </div>
                              <div className="w-full bg-muted/50 rounded-full h-1.5">
                                <div className={`${split.bg} rounded-full h-1.5 transition-all`} style={{ width: `${barWidth}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Grid of Assets & Liabilities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assets column */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1.5">
            Assets Breakdown
          </h3>
          {!detailsSnapshot.assetBreakdown || detailsSnapshot.assetBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No assets recorded in this snapshot.</p>
          ) : (
            (() => {
              const assetGroups: { label: string; items: typeof detailsSnapshot.assetBreakdown extends Array<infer T> ? T[] : never }[] = [
                { label: 'Mutual Funds', items: detailsSnapshot.assetBreakdown.filter(a => a.type === 'mutual_fund') },
                { label: 'Stocks', items: detailsSnapshot.assetBreakdown.filter(a => a.type === 'stock') },
                { label: 'Deposits', items: detailsSnapshot.assetBreakdown.filter(a => ['fixed_deposit', 'recurring_deposit', 'ppf'].includes(a.type)) },
                { label: 'Savings Accounts', items: detailsSnapshot.assetBreakdown.filter(a => a.type === 'savings_account') },
                { label: 'Other Assets', items: detailsSnapshot.assetBreakdown.filter(a => ['real_estate', 'crypto', 'cash', 'other'].includes(a.type)) },
              ].filter(g => g.items.length > 0)
              return (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {assetGroups.map((group) => {
                    const groupTotal = group.items.reduce((sum, a) => sum + a.value, 0)
                    return (
                      <div key={group.label} className="rounded-md border border-border/30 overflow-hidden">
                        <div className="flex justify-between items-center px-3 py-2 bg-muted/50 border-b border-border/20">
                          <span className="text-xs font-semibold text-foreground">{group.label}</span>
                          <span className="text-xs font-mono text-emerald-400 font-semibold">{formatINR(groupTotal)}</span>
                        </div>
                        <div className="divide-y divide-border/20">
                          {group.items.sort((a, b) => a.name.localeCompare(b.name)).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-3 py-1.5 text-xs">
                              <span className="text-muted-foreground">{item.name}</span>
                              <span className="font-mono text-emerald-400/80">{formatINR(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
        </div>

        {/* Liabilities column */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-1.5">
            Liabilities Breakdown
          </h3>
          {!detailsSnapshot.liabilityBreakdown || detailsSnapshot.liabilityBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No liabilities recorded in this snapshot.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {detailsSnapshot.liabilityBreakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/40 border border-border/20 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{item.type.replace('_', ' ')}</span>
                  </div>
                  <span className="font-mono text-rose-400 font-semibold">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )}

  <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1.5 text-xs font-medium cursor-pointer transition-colors"
      >
        <Download size={13} />
        <span>Export Snapshot</span>
        <ChevronDown size={11} className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-card border-border shadow-lg p-1">
        <DropdownMenuItem
          onClick={() => detailsSnapshot && handleExportSnapshotPdf(detailsSnapshot)}
          className="cursor-pointer gap-2 p-2 text-xs"
        >
          <FileText size={14} className="text-primary" />
          <span>Export PDF Statement</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => detailsSnapshot && handleExportSnapshotCsv(detailsSnapshot)}
          className="cursor-pointer gap-2 p-2 text-xs"
        >
          <FileSpreadsheet size={14} className="text-emerald-400" />
          <span>Export CSV Spreadsheet</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button onClick={() => setDetailsSnapshot(null)} className="bg-secondary text-foreground hover:bg-secondary/80">
      Close
    </Button>
  </DialogFooter>
</DialogContent>
</Dialog>

{/* Delete Snapshot Confirmation Dialog */}
<ConfirmDialog
open={!!deleteSnapshotId}
onOpenChange={(val) => !val && setDeleteSnapshotId(null)}
title="Delete Snapshot"
description="This will permanently delete this net worth snapshot. This cannot be undone."
confirmLabel="Delete"
destructive={true}
onConfirm={async () => {
  if (deleteSnapshotId) {
    await handleDeleteSnapshot(deleteSnapshotId)
  }
  setDeleteSnapshotId(null)}
}
/>

      {/* Restore Snapshot Confirmation Dialog */}
      <ConfirmDialog
        open={!!restoreSnapshotId}
        onOpenChange={(val) => !val && setRestoreSnapshotId(null)}
        title="Restore Snapshot"
        description="This will replace all your current active assets and liabilities for this member with the values from this snapshot. This cannot be undone."
        confirmLabel="Restore"
        onConfirm={async () => {
          if (restoreSnapshotId) {
            await handleCopySnapshot(restoreSnapshotId)
          }
          setRestoreSnapshotId(null)
        }}
      />
</div>
)
}

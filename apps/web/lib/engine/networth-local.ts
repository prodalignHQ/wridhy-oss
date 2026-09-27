// ─── Net-worth local engine ─────────────────────────────────────────────────
// Ports apps/api/src/routes/networth.ts read + mutation semantics to the
// OPFS cache: live compute with owner-scope rules, snapshot save (same
// month+owner replace), copy/restore from breakdowns, draft save/delete,
// asset/liability CRUD. resolveAssetTag is shared from @momoney/utils.

import { resolveAssetTag } from '@momoney/utils'
import {
  cacheServerRows,
  deleteRowFromCache,
  logChangeToCache,
  readLocalCache,
  type LocalCache,
} from './opfs-db'
import { scheduleEncryptedBackup } from './mutations'
import type {
  LocalAsset,
  LocalLiability,
  LocalNetWorthDraft,
  LocalNetWorthSnapshot,
} from '@momoney/local-engine'

function inScope(ownerId: string | null, ownerIds: string[] | null, defaultOwnerId?: string | null): boolean {
  if (!ownerIds || ownerIds.length === 0) return true
  if (ownerIds.length === 1 && ownerIds[0]) {
    const single = ownerIds[0]
    if (defaultOwnerId && single === defaultOwnerId) return ownerId === single || ownerId === null
    return ownerId === single
  }
  const hasDefault = defaultOwnerId ? ownerIds.includes(defaultOwnerId) : false
  if (hasDefault) return ownerId === null || (ownerId ? ownerIds.includes(ownerId) : false)
  return ownerId !== null && ownerIds.includes(ownerId)
}

function defaultOwnerOf(cache: LocalCache): string | undefined {
  return cache.owners.find((o) => o.isDefault)?.id
}

export interface LiveNetWorth {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  assets: LocalAsset[]
  liabilities: LocalLiability[]
}

export async function computeLiveLocal(
  ownerIds: string[] | null,
  cache?: LocalCache | null
): Promise<LiveNetWorth> {
  const c = cache ?? (await readLocalCache().catch(() => null)) ?? null
  const assets = (c?.assets ?? []).filter((a) => inScope(a.ownerId, ownerIds, c ? defaultOwnerOf(c) : undefined))
  const liabilities = (c?.liabilities ?? []).filter((l) => inScope(l.ownerId, ownerIds, c ? defaultOwnerOf(c) : undefined))
  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.outstandingAmount) || 0), 0)
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, assets, liabilities }
}

export async function listSnapshotsLocal(
  ownerIds: string[] | null,
  cache?: LocalCache | null
): Promise<LocalNetWorthSnapshot[]> {
  const c = cache ?? (await readLocalCache().catch(() => null)) ?? null
  if (!c) return []
  const dflt = defaultOwnerOf(c)
  return [...c.netWorthSnapshots]
    .filter((s) => inScope(s.ownerId, ownerIds, dflt))
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
}

export async function getDraftLocal(
  ownerId: string | null | undefined,
  cache?: LocalCache | null
): Promise<LocalNetWorthDraft | null> {
  const c = cache ?? (await readLocalCache().catch(() => null)) ?? null
  if (!c) return null
  const oid = ownerId ?? defaultOwnerOf(c) ?? null
  return c.netWorthDrafts.find((d) => (d.ownerId ?? null) === oid) ?? null
}

function monthStart(dateInput?: string): string {
  const base = dateInput ? new Date(dateInput) : new Date()
  const d = isNaN(base.getTime()) ? new Date() : base
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function saveSnapshotLocal(ownerId?: string | null, date?: string): Promise<void> {
  const cache = await readLocalCache().catch(() => null)
  const live = await computeLiveLocal(ownerId ? [ownerId] : null, cache)
  const oid = ownerId ?? (cache ? defaultOwnerOf(cache) : undefined) ?? null
  const snapshotDate = monthStart(date)
  const existing = cache?.netWorthSnapshots.find(
    (s) => (s.ownerId ?? null) === oid && s.snapshotDate === snapshotDate
  )
  const id = existing?.id ?? crypto.randomUUID()
  const now = new Date().toISOString()
  await cacheServerRows({
    netWorthSnapshots: [
      {
        id,
        ownerId: oid,
        snapshotDate,
        totalAssets: live.totalAssets.toFixed(2),
        totalLiabilities: live.totalLiabilities.toFixed(2),
        netWorth: live.netWorth.toFixed(2),
        assetBreakdown: live.assets.map((a) => ({
          name: a.name,
          type: a.type,
          value: parseFloat(a.value) || 0,
          metadata: a.metadata,
          equityDebtTag: resolveAssetTag(a.type, a.metadata, a.equityDebtTag),
        })),
        liabilityBreakdown: live.liabilities.map((l) => ({
          name: l.name,
          type: l.type,
          amount: parseFloat(l.outstandingAmount) || 0,
          interestRate: l.interestRate ? parseFloat(l.interestRate) : undefined,
          monthlyPayment: l.monthlyPayment ? parseFloat(l.monthlyPayment) : undefined,
        })),
        notes: existing?.notes ?? null,
        createdAt: existing?.createdAt ?? now,
      },
    ],
  })
  await logChangeToCache('local_networth_snapshots', id, existing ? 'update' : 'create').catch(() => {})
  // Auto-clear draft after successful snapshot (mirrors the server).
  const draft = await getDraftLocal(oid, cache)
  if (draft) {
    await deleteRowFromCache('local_networth_drafts', draft.id).catch(() => {})
  }
  scheduleEncryptedBackup()
}

/** Copy/restore: replace live rows in scope with a snapshot's breakdown. */
export async function copySnapshotLocal(
  snapshotId: string,
  adjusted?: { adjustedAssets?: any[]; adjustedLiabilities?: any[] }
): Promise<void> {
  const cache = await readLocalCache().catch(() => null)
  if (!cache) throw new Error('Local cache unavailable')
  const snap = cache.netWorthSnapshots.find((s) => s.id === snapshotId)
  if (!snap) throw new Error('Snapshot not found on this device')
  const dflt = defaultOwnerOf(cache) ?? null
  const targetOwnerId = snap.ownerId ?? dflt
  const inDeleteScope = (ownerId: string | null) => {
    if (targetOwnerId && targetOwnerId === dflt) return ownerId === targetOwnerId || ownerId === null
    if (targetOwnerId) return ownerId === targetOwnerId
    return ownerId === dflt || ownerId === null
  }
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  for (const a of cache.assets.filter((x) => inDeleteScope(x.ownerId))) {
    await deleteRowFromCache('local_assets', a.id).catch(() => {})
  }
  for (const l of cache.liabilities.filter((x) => inDeleteScope(x.ownerId))) {
    await deleteRowFromCache('local_liabilities', l.id).catch(() => {})
  }

  const srcAssets = (adjusted?.adjustedAssets?.length ? adjusted.adjustedAssets : snap.assetBreakdown ?? []) as any[]
  const srcLiabs = (adjusted?.adjustedLiabilities?.length ? adjusted.adjustedLiabilities : snap.liabilityBreakdown ?? []) as any[]

  await cacheServerRows({
    assets: srcAssets.map((a) => ({
      id: crypto.randomUUID(),
      ownerId: targetOwnerId,
      name: String(a.name ?? 'Asset'),
      type: String(a.type ?? 'other'),
      value: Number(a.value ?? 0).toFixed(2),
      currency: 'INR',
      equityDebtTag: a.equityDebtTag ?? resolveAssetTag(String(a.type ?? 'other'), a.metadata, undefined),
      metadata: a.metadata ?? {},
      valuationDate: today,
      createdAt: now,
      updatedAt: now,
    })),
    liabilities: srcLiabs.map((l) => ({
      id: crypto.randomUUID(),
      ownerId: targetOwnerId,
      name: String(l.name ?? 'Liability'),
      type: String(l.type ?? 'other'),
      outstandingAmount: Number(l.amount ?? l.outstandingAmount ?? 0).toFixed(2),
      interestRate: l.interestRate !== undefined && l.interestRate !== null ? String(l.interestRate) : null,
      monthlyPayment: l.monthlyPayment !== undefined && l.monthlyPayment !== null ? String(l.monthlyPayment) : null,
      lastUpdated: today,
      createdAt: now,
    })),
  })
  await logChangeToCache('local_assets', targetOwnerId ?? 'all', 'update').catch(() => {})
  scheduleEncryptedBackup()
}

export async function deleteSnapshotLocal(id: string): Promise<void> {
  await deleteRowFromCache('local_networth_snapshots', id)
  scheduleEncryptedBackup()
}

/** Snapshot current live into the draft (server PUT {} semantics). */
export async function saveDraftLocal(ownerId?: string | null): Promise<void> {
  const cache = await readLocalCache().catch(() => null)
  const oid = ownerId ?? (cache ? defaultOwnerOf(cache) : undefined) ?? null
  const live = await computeLiveLocal(oid ? [oid] : null, cache)
  const existing = await getDraftLocal(oid, cache)
  const id = existing?.id ?? crypto.randomUUID()
  await cacheServerRows({
    netWorthDrafts: [
      {
        id,
        ownerId: oid,
        assetBreakdown: live.assets.map((a) => ({
          name: a.name,
          type: a.type,
          value: parseFloat(a.value) || 0,
          metadata: a.metadata,
        })),
        liabilityBreakdown: live.liabilities.map((l) => ({
          name: l.name,
          type: l.type,
          amount: parseFloat(l.outstandingAmount) || 0,
        })),
        savedAt: new Date().toISOString(),
      },
    ],
  })
  await logChangeToCache('local_networth_drafts', id, existing ? 'update' : 'create').catch(() => {})
  scheduleEncryptedBackup()
}

export async function deleteDraftLocal(ownerId?: string | null): Promise<void> {
  const cache = await readLocalCache().catch(() => null)
  const oid = ownerId ?? (cache ? defaultOwnerOf(cache) : undefined) ?? null
  const existing = await getDraftLocal(oid, cache)
  if (existing) await deleteRowFromCache('local_networth_drafts', existing.id)
}

export interface AssetInput {
  name: string
  type: string
  value: number | string
  currency?: string
  valuationDate: string
  metadata?: Record<string, unknown>
  ownerId?: string | null
  equityDebtTag?: string | null
}

export async function saveAssetLocal(input: AssetInput, id?: string, fallbackOwnerId?: string | null): Promise<void> {
  const now = new Date().toISOString()
  const rowId = id ?? crypto.randomUUID()
  await cacheServerRows({
    assets: [
      {
        id: rowId,
        ownerId: input.ownerId ?? fallbackOwnerId ?? null,
        name: input.name,
        type: input.type,
        value: Number(input.value).toFixed(2),
        currency: input.currency ?? 'INR',
        equityDebtTag: input.equityDebtTag ?? resolveAssetTag(input.type, input.metadata, null),
        metadata: input.metadata ?? {},
        valuationDate: String(input.valuationDate).slice(0, 10),
        createdAt: now,
        updatedAt: now,
      },
    ],
  })
  await logChangeToCache('local_assets', rowId, id ? 'update' : 'create').catch(() => {})
  scheduleEncryptedBackup()
}

export async function deleteAssetLocal(id: string): Promise<void> {
  await deleteRowFromCache('local_assets', id)
  scheduleEncryptedBackup()
}

export interface LiabilityInput {
  name: string
  type: string
  outstandingAmount: number | string
  interestRate?: number | string | null
  monthlyPayment?: number | string | null
  lastUpdated: string
  ownerId?: string | null
}

export async function saveLiabilityLocal(
  input: LiabilityInput,
  id?: string,
  fallbackOwnerId?: string | null
): Promise<void> {
  const now = new Date().toISOString()
  const rowId = id ?? crypto.randomUUID()
  await cacheServerRows({
    liabilities: [
      {
        id: rowId,
        ownerId: input.ownerId ?? fallbackOwnerId ?? null,
        name: input.name,
        type: input.type,
        outstandingAmount: Number(input.outstandingAmount).toFixed(2),
        interestRate: input.interestRate !== undefined && input.interestRate !== null ? String(input.interestRate) : null,
        monthlyPayment:
          input.monthlyPayment !== undefined && input.monthlyPayment !== null ? String(input.monthlyPayment) : null,
        lastUpdated: String(input.lastUpdated).slice(0, 10),
        createdAt: now,
      },
    ],
  })
  await logChangeToCache('local_liabilities', rowId, id ? 'update' : 'create').catch(() => {})
  scheduleEncryptedBackup()
}

export async function deleteLiabilityLocal(id: string): Promise<void> {
  await deleteRowFromCache('local_liabilities', id)
  scheduleEncryptedBackup()
}

export interface NetWorthPageData {
  data: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    assets: LocalAsset[]
    liabilities: LocalLiability[]
  }
  snapshots: Array<LocalNetWorthSnapshot & { owner?: { id: string; name: string; color: string } | null }>
  draft: { savedAt: string; assetBreakdown?: any[]; liabilityBreakdown?: any[] } | null
  owners: Array<{ id: string; name: string; notes: string | null; color: string; isDefault: boolean }>
}

/** Full page load from OPFS (vault users). Mirrors fetchAll's server shape. */
export async function loadNetWorthPageLocal(
  ownerIds: string[],
  isAllSelected: boolean,
  singleOwnerId: string | null,
  defaultOwnerId?: string
): Promise<NetWorthPageData> {
  const cache = await readLocalCache().catch(() => null)
  const ids = isAllSelected ? null : ownerIds
  const live = await computeLiveLocal(ids, cache)
  const snapshots = await listSnapshotsLocal(ids, cache)
  const targetOwnerId = singleOwnerId || defaultOwnerId || (cache ? defaultOwnerOf(cache) : undefined) || null
  const draft = await getDraftLocal(targetOwnerId, cache)
  const owners = (cache?.owners ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    notes: o.notes,
    color: o.color,
    isDefault: o.isDefault,
  }))
  const ownerById = new Map(owners.map((o) => [o.id, o]))
  return {
    data: {
      totalAssets: live.totalAssets,
      totalLiabilities: live.totalLiabilities,
      netWorth: live.netWorth,
      assets: live.assets,
      liabilities: live.liabilities,
    },
    snapshots: snapshots.map((s) => {
      const o = s.ownerId ? ownerById.get(s.ownerId) : undefined
      return {
        ...s,
        owner: o ? { id: o.id, name: o.name, color: o.color } : null,
      }
    }),
    draft: draft
      ? {
          savedAt: draft.savedAt,
          assetBreakdown: (draft.assetBreakdown ?? []) as any[],
          liabilityBreakdown: (draft.liabilityBreakdown ?? []) as any[],
        }
      : null,
    owners,
  }
}

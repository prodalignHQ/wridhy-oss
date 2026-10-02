'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Trash2, Edit2, Lock, ArrowRight, Search,
  Sliders, Check, Loader2, RefreshCw, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHelp } from '@/components/guide/PageHelp'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  type?: 'expense' | 'investment' | 'income' | 'transfer'
  isSystem: boolean
}

function isProtectedCategory(cat: Category): boolean {
  if (!cat.isSystem) return false
  const lowerName = cat.name.trim().toLowerCase()
  return (
    lowerName === 'income' ||
    lowerName === 'investments' ||
    lowerName === 'investment' ||
    lowerName === 'transfers' ||
    lowerName === 'transfer' ||
    lowerName === 'uncategorized' ||
    cat.type === 'income' ||
    cat.type === 'investment' ||
    cat.type === 'transfer'
  )
}

interface Rule {
  id: string
  matchField: 'merchant' | 'description' | 'amount'
  matchType: 'contains' | 'equals' | 'regex' | 'gt' | 'lt'
  matchValue: string
  categoryId: string
  priority: number
  source: 'system' | 'user'
  isActive: boolean
  category?: Category
}

interface Transaction {
  id: string
  date: Date
  description: string
  amount: string
  type: 'debit' | 'credit'
}

interface PreviewResult {
  count: number
  samples: Transaction[]
}

// ─── Components ────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onEdit,
  onDelete,
  onToggle
}: {
  rule: Rule
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  onToggle: (rule: Rule, active: boolean) => void
}) {
  const isSystem = rule.source === 'system'

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-3 rounded-lg border transition-all',
      rule.isActive
        ? 'bg-card border-border'
        : 'bg-card/50 border-border opacity-60'
    )}>
      {/* Priority */}
      <div className="w-10 text-center">
        <span className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-muted text-xs font-mono text-muted-foreground">
          {rule.priority}
        </span>
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 text-sm">
        <div className="text-muted-foreground capitalize">{rule.matchField}</div>
        <div className="text-muted-foreground">{rule.matchType}</div>
        <div className="font-mono text-foreground/80 truncate" title={rule.matchValue}>
          {rule.matchValue}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />

      {/* Category */}
      <div className="w-36 flex items-center gap-2">
        {rule.category && (
          <>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: rule.category.color }}
            />
            <span className="text-foreground/80 text-sm truncate">
              {rule.category.name}
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isSystem && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground/80 uppercase tracking-wider">
            Default
          </span>
        )}
        <Switch
          checked={rule.isActive}
          onCheckedChange={(checked) => onToggle(rule, checked)}
          className="data-[state=checked]:bg-primary"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground/80"
          onClick={() => onEdit(rule)}
          title="Edit Rule"
        >
          <Edit2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-rose-400"
          onClick={() => onDelete(rule)}
          title="Delete Rule"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  loading?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null)
  const [reapplyLoading, setReapplyLoading] = useState(false)

  // Category form state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState<'expense' | 'investment' | 'income' | 'transfer'>('expense')
  const [categoryColor, setCategoryColor] = useState('#6366f1')
  const [categoryIcon, setCategoryIcon] = useState('📂')
  const [categoryLoading, setCategoryLoading] = useState(false)

  // Category deletion state
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null)
  const [categoryUsage, setCategoryUsage] = useState<{
    transactionCount: number
    ruleCount: number
    isProtected: boolean
  } | null>(null)
  const [loadingCategoryUsage, setLoadingCategoryUsage] = useState(false)
  const [categoryRemapTargetId, setCategoryRemapTargetId] = useState<string>('')
  const [reassignAction, setReassignAction] = useState<'remap' | 'uncategorize'>('remap')
  const [deletingCategory, setDeletingCategory] = useState(false)

  const PRESET_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#71717a', // Zinc
  ]

  const PRESET_ICONS = ['📂', '🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '✈️', '💰', '🔄', '📱', '🏠']


  // Form state
  const [formMatchField, setFormMatchField] = useState<string>('description')
  const [formMatchType, setFormMatchType] = useState<string>('contains')
  const [formMatchValue, setFormMatchValue] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formPriority, setFormPriority] = useState(100)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { loadReferenceMerged } = await import('@/lib/engine/reference')
        const [rulesData, categoriesData] = await Promise.all([
          loadReferenceMerged('rules', () => apiClient.fetch<Rule[]>('/v1/rules')),
          loadReferenceMerged('categories', () => apiClient.fetch<Category[]>('/v1/categories')),
        ])
        setRules(rulesData as Rule[])
        setCategories(categoriesData as Category[])
        return
      }
      const [rulesData, categoriesData] = await Promise.all([
        apiClient.fetch<Rule[]>('/v1/rules'),
        apiClient.fetch<Category[]>('/v1/categories'),
      ])
      setRules(rulesData)
      setCategories(categoriesData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      toast.error('Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset form when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      if (editingRule) {
        setFormMatchField(editingRule.matchField)
        setFormMatchType(editingRule.matchType)
        setFormMatchValue(editingRule.matchValue)
        setFormCategoryId(editingRule.categoryId)
        setFormPriority(editingRule.priority)
      } else {
        setFormMatchField('description')
        setFormMatchType('contains')
        setFormMatchValue('')
        setFormPriority(100)
        // Only set default if not already set or categories just loaded
        if (categories.length > 0 && !formCategoryId) {
          setFormCategoryId(categories[0].id)
        }
      }
    }
  }, [dialogOpen, editingRule, categories.length])

  // Fetch preview when form changes — pure local compute (no server needed).
  useEffect(() => {
    if (!formMatchValue || !formCategoryId) {
      setPreview(null)
      return
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const { useVaultStore } = await import('@/lib/store/vault.store')
        if (useVaultStore.getState().isUnlocked()) {
          const [{ readLocalCache }, { categorize }] = await Promise.all([
            import('@/lib/engine/opfs-db'),
            import('@momoney/rules-engine'),
          ])
          const cache = await readLocalCache().catch(() => null)
          const txns = cache?.transactions ?? []
          const proposed = {
            id: 'preview',
            userId: null,
            matchField: formMatchField as 'merchant' | 'description' | 'amount',
            matchType: formMatchType as 'contains' | 'equals' | 'regex' | 'gt' | 'lt',
            matchValue: formMatchValue,
            categoryId: formCategoryId,
            priority: 1,
            source: 'user' as const,
            isActive: true,
          }
          const matched = txns.filter((t) => {
            const r = categorize(
              { date: new Date(t.date), description: t.description, amount: parseFloat(t.amount), type: t.type },
              [proposed],
              [],
              [],
              []
            )
            return r.matchedOn === 'rule'
          })
          setPreview({ count: matched.length, samples: matched.slice(0, 5) as any })
          return
        }
        const result = await apiClient.fetch<PreviewResult>('/v1/rules/preview', {
          method: 'POST',
          body: JSON.stringify({
            matchField: formMatchField,
            matchType: formMatchType,
            matchValue: formMatchValue,
            categoryId: formCategoryId,
          }),
        })
        setPreview(result)
      } catch (err) {
        console.error('Preview error:', err)
        setPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formMatchField, formMatchType, formMatchValue, formCategoryId])

  const userRules = rules.filter(r => r.source === 'user')
  const systemRules = rules.filter(r => r.source === 'system')

  const handleSelectChange = (value: string) => {
    setFormCategoryId(value)
  }

  const handleSave = async () => {
    const data = {
      matchField: formMatchField,
      matchType: formMatchType,
      matchValue: formMatchValue,
      categoryId: formCategoryId,
      priority: formPriority,
    }

    const { useVaultStore } = await import('@/lib/store/vault.store')
    if (useVaultStore.getState().isUnlocked()) {
      try {
        const { createReferenceRow, updateReferenceRow } = await import('@/lib/engine/reference')
        if (editingRule) {
          const ok = await updateReferenceRow('rules', {
            id: editingRule.id,
            userId: (editingRule as any).userId ?? null,
            matchField: data.matchField,
            matchType: data.matchType,
            matchValue: data.matchValue,
            categoryId: data.categoryId,
            priority: data.priority,
            source: (editingRule as any).source ?? 'user',
            isActive: (editingRule as any).isActive ?? true,
          })
          if (!ok) throw new Error('Could not save on this device')
          toast.success('Rule updated')
        } else {
          const ok = await createReferenceRow('rules', {
            id: crypto.randomUUID(),
            userId: null,
            matchField: data.matchField,
            matchType: data.matchType,
            matchValue: data.matchValue,
            categoryId: data.categoryId,
            priority: data.priority ?? 100,
            source: 'user',
            isActive: true,
          })
          if (!ok) throw new Error('Could not save on this device')
          toast.success('Rule created')
        }
        fetchData()
      } catch (err) {
        console.error('Failed to save rule:', err)
        toast.error('Failed to save rule')
      } finally {
        setDialogOpen(false)
        setEditingRule(null)
      }
      return
    }

    if (editingRule) {
      apiClient.fetch(`/v1/rules/${editingRule.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then(() => {
        toast.success('Rule updated')
        fetchData()
      }).catch(err => {
        console.error('Failed to update rule:', err)
        toast.error('Failed to update rule')
      })
    } else {
      apiClient.fetch('/v1/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(() => {
        toast.success('Rule created')
        fetchData()
      }).catch(err => {
        console.error('Failed to create rule:', err)
        toast.error('Failed to create rule')
      })
    }
    setDialogOpen(false)
    setEditingRule(null)
  }

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) return

    setCategoryLoading(true)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { createReferenceRow } = await import('@/lib/engine/reference')
        const ok = await createReferenceRow('categories', {
          id: crypto.randomUUID(),
          name: categoryName.trim(),
          type: categoryType,
          icon: categoryIcon,
          color: categoryColor,
        })
        if (!ok) throw new Error('Could not save on this device')
        toast.success('Category created')
        setCategoryName('')
        setCategoryType('expense')
        setCategoryDialogOpen(false)
        fetchData()
        return
      }
      await apiClient.fetch('/v1/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryName.trim(),
          type: categoryType,
          color: categoryColor,
          icon: categoryIcon,
        }),
      })
      toast.success('Category created')
      setCategoryName('')
      setCategoryType('expense')
      setCategoryDialogOpen(false)
      fetchData()
    } catch (err) {
      console.error('Failed to create category:', err)
      toast.error('Failed to create category')
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleInitiateDeleteCategory = async (cat: Category) => {
    if (isProtectedCategory(cat)) return
    setDeleteCategoryTarget(cat)
    setCategoryUsage(null)
    setCategoryRemapTargetId('')
    setReassignAction('remap')
    setLoadingCategoryUsage(true)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { categoryUsageLocal } = await import('@/lib/engine/reference')
        const usage = await categoryUsageLocal(cat.id)
        setCategoryUsage({ ...usage, isProtected: false })
        const otherCats = categories.filter(c => c.id !== cat.id)
        if (otherCats.length > 0) {
          setCategoryRemapTargetId(otherCats[0].id)
        }
        return
      }
      const res = await apiClient.fetch<{
        transactionCount: number
        ruleCount: number
        isProtected: boolean
      }>(`/v1/categories/${cat.id}/usage`)
      setCategoryUsage(res)
      const otherCats = categories.filter(c => c.id !== cat.id)
      if (otherCats.length > 0) {
        setCategoryRemapTargetId(otherCats[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch category usage:', err)
      toast.error('Failed to check category usage')
    } finally {
      setLoadingCategoryUsage(false)
    }
  }

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return
    setDeletingCategory(true)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        let moveToCategoryId: string | null | undefined = undefined
        if (categoryUsage && categoryUsage.transactionCount > 0) {
          moveToCategoryId = reassignAction === 'remap' ? categoryRemapTargetId : null
        }
        const { deleteCategoryLocal } = await import('@/lib/engine/reference')
        const res = await deleteCategoryLocal(deleteCategoryTarget.id, moveToCategoryId)
        if (res.remappedTransactionsCount > 0) {
          toast.success(
            `Category deleted and ${res.remappedTransactionsCount} transaction${res.remappedTransactionsCount > 1 ? 's' : ''} remapped`
          )
        } else {
          toast.success('Category deleted')
        }
        setDeleteCategoryTarget(null)
        fetchData()
        return
      }
      let moveToCategoryId: string | null | undefined = undefined
      if (categoryUsage && categoryUsage.transactionCount > 0) {
        moveToCategoryId = reassignAction === 'remap' ? categoryRemapTargetId : null
      }

      const res = await apiClient.fetch<{
        deletedCategoryId: string
        remappedToCategoryId: string | null
        remappedTransactionsCount: number
      }>(`/v1/categories/${deleteCategoryTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ moveToCategoryId }),
      })

      if (res.remappedTransactionsCount > 0) {
        toast.success(
          `Category deleted and ${res.remappedTransactionsCount} transaction${res.remappedTransactionsCount > 1 ? 's' : ''} remapped`
        )
      } else {
        toast.success('Category deleted')
      }

      setDeleteCategoryTarget(null)
      fetchData()
    } catch (err: any) {
      console.error('Failed to delete category:', err)
      toast.error(err?.message || 'Failed to delete category')
    } finally {
      setDeletingCategory(false)
    }
  }


  const handleDeleteRule = async () => {
    if (!deleteTarget) return
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { deleteReferenceRow } = await import('@/lib/engine/reference')
        const ok = await deleteReferenceRow('rules', deleteTarget.id)
        if (!ok) throw new Error('Could not delete on this device')
        toast.success('Rule deleted')
        setDeleteTarget(null)
        fetchData()
        return
      }
      await apiClient.fetch(`/v1/rules/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      toast.success('Rule deleted')
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      console.error('Failed to delete rule:', err)
      toast.error('Failed to delete rule')
    }
  }

  const handleToggleRule = async (rule: Rule, active: boolean) => {
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        const { updateReferenceRow } = await import('@/lib/engine/reference')
        const ok = await updateReferenceRow('rules', { ...(rule as unknown as Record<string, unknown>), isActive: active, id: rule.id })
        if (!ok) throw new Error('Could not save on this device')
        fetchData()
        return
      }
      await apiClient.fetch(`/v1/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: active }),
      })
      fetchData()
    } catch (err) {
      console.error('Failed to toggle rule:', err)
      toast.error('Failed to update rule')
    }
  }

  const handleReapply = async () => {
    setReapplyLoading(true)
    try {
      const { useVaultStore } = await import('@/lib/store/vault.store')
      if (useVaultStore.getState().isUnlocked()) {
        // Local reapply: full categorize() over uncategorized transactions
        // (a superset of the server's description/merchant-only matching —
        // amount rules also apply here).
        const [{ readLocalCache, patchTransactionInCache }, { categorize }, { getDefaultMerchants }] =
          await Promise.all([
            import('@/lib/engine/opfs-db'),
            import('@momoney/rules-engine'),
            import('@momoney/rules-engine'),
          ])
        const cache = await readLocalCache().catch(() => null)
        if (!cache) throw new Error('Local cache unavailable')
        const uncategorizedName = 'Uncategorized'
        const targets = cache.transactions.filter((t) => {
          if (t.categoryId) {
            const cat = cache.categories.find((c) => c.id === t.categoryId)
            return !cat || cat.name === uncategorizedName
          }
          return true
        })
        const activeRules = cache.rules.filter((r) => r.isActive)
        const userMerchants = cache.merchants.filter((m) => !m.isSystem)
        let updatedCount = 0
        for (const t of targets) {
          const result = categorize(
            { date: new Date(t.date), description: t.description, amount: parseFloat(t.amount), type: t.type },
            activeRules,
            cache.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
            userMerchants,
            getDefaultMerchants()
          )
          if (result.categoryId && result.categoryId !== (t.categoryId ?? '')) {
            if (await patchTransactionInCache(t.id, { categoryId: result.categoryId })) updatedCount++
          }
        }
        const { scheduleEncryptedBackup } = await import('@/lib/engine/mutations')
        scheduleEncryptedBackup()
        toast.success(`Updated ${updatedCount} transactions`)
        fetchData()
        return
      }
      const result = await apiClient.fetch<{ updatedCount: number }>('/v1/rules/reapply', {
        method: 'POST',
      })
      toast.success(`Updated ${result.updatedCount} transactions`)
    } catch (err) {
      console.error('Failed to reapply rules:', err)
      toast.error('Failed to reapply rules')
    } finally {
      setReapplyLoading(false)
    }
  }

  const openEditDialog = (rule: Rule) => {
    setEditingRule(rule)
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingRule(null)
    setDialogOpen(true)
  }

  const selectedCategory = categories.find(c => c.id === formCategoryId)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading rules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-semibold text-foreground">Rules</h1>
            <PageHelp section="rules" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-categorize transactions based on patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border text-foreground/80 gap-2"
            onClick={handleReapply}
            disabled={reapplyLoading}
          >
            {reapplyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Re-apply Rules
          </Button>
          <Button className="bg-primary hover:bg-primary gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my-rules" className="w-full">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="my-rules">
            My Rules ({userRules.length})
          </TabsTrigger>
          <TabsTrigger value="system-rules">
            System Rules ({systemRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-rules" className="mt-4 space-y-3">
          {userRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
              <Sliders className="w-10 h-10 text-muted-foreground/70 mb-3" />
              <h3 className="text-foreground/80 font-medium mb-1">No custom rules yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Create rules like &quot;description contains NETFLIX → Subscriptions&quot; to auto-categorize transactions
              </p>
              <Button className="bg-primary hover:bg-primary" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {userRules
                .sort((a, b) => a.priority - b.priority)
                .map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onEdit={openEditDialog}
                    onDelete={setDeleteTarget}
                    onToggle={handleToggleRule}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system-rules" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            System rules are maintained by MoMoney. Create a My Rule with a lower priority number to override them.
          </p>
          <div className="space-y-2">
            {systemRules
              .sort((a, b) => a.priority - b.priority)
              .map(rule => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onEdit={() => { }}
                  onDelete={() => { }}
                  onToggle={() => { }}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Categories Section */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Categories</h2>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground/80 gap-2 h-8"
            onClick={() => setCategoryDialogOpen(true)}
          >
            <Plus className="w-3 h-3" />
            New Category
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">

          {categories.map(cat => {
            const isProtected = isProtectedCategory(cat)
            return (
              <div
                key={cat.id}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
                  cat.isSystem
                    ? 'bg-muted text-foreground/80'
                    : 'bg-muted/60 text-foreground/80 border border-border'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
                {cat.type && cat.type !== 'expense' && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded font-medium uppercase tracking-wider",
                    cat.type === 'investment' ? "bg-emerald-500/15 text-emerald-300" :
                    cat.type === 'income' ? "bg-sky-500/15 text-sky-300" : "bg-purple-500/15 text-purple-300"
                  )}>
                    {cat.type}
                  </span>
                )}
                {isProtected ? (
                  <span title="Core system category (required for accounting & reports)">
                    <Lock className="w-3 h-3 text-muted-foreground/70" />
                  </span>
                ) : (
                  <button
                    onClick={() => handleInitiateDeleteCategory(cat)}
                    className="hover:text-rose-400 transition-colors ml-1"
                    title={cat.isSystem ? 'Delete system category' : 'Delete category'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>


      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) setEditingRule(null)
      }}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define a pattern to automatically categorize transactions
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              {/* Match Field */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Match Field</label>
                <Select value={formMatchField} onValueChange={(v) => setFormMatchField(v || 'description')}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="description" className="text-foreground/90">Description</SelectItem>
                    <SelectItem value="merchant" className="text-foreground/90">Merchant</SelectItem>
                    <SelectItem value="amount" className="text-foreground/90">Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Type */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Match Type</label>
                <Select value={formMatchType} onValueChange={(v) => setFormMatchType(v || 'contains')}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select match type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="contains" className="text-foreground/90">Contains</SelectItem>
                    <SelectItem value="equals" className="text-foreground/90">Equals</SelectItem>
                    <SelectItem value="regex" className="text-foreground/90">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Value */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Match Value</label>
                <Input
                  value={formMatchValue}
                  onChange={(e) => setFormMatchValue(e.target.value)}
                  placeholder={formMatchType === 'regex' ? '.*NETFLIX.*' : 'NETFLIX'}
                  className="bg-muted border-border font-mono"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Assign Category</label>
                <Select value={formCategoryId} onValueChange={(v) => v && setFormCategoryId(v)}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id} label={cat.name} className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Priority (1-999)</label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 100)}
                  className="bg-muted border-border w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Lower = higher priority. User rules override system rules.
                </p>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="bg-background rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground/80">Preview</span>
                {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>

              {previewLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                </div>
              ) : preview ? (
                <>
                  <p className="text-sm">
                    <span className="font-semibold text-foreground/90">{preview.count}</span>
                    <span className="text-muted-foreground"> transactions would match</span>
                  </p>
                  {preview.samples.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Sample matches</p>
                      {preview.samples.slice(0, 3).map(txn => (
                        <div
                          key={txn.id}
                          className="text-xs bg-card rounded p-2 flex justify-between"
                        >
                          <span className="text-muted-foreground truncate flex-1">{txn.description}</span>
                          <span className="text-muted-foreground font-mono ml-2">
                            ₹{parseFloat(txn.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center">
                  <Search className="w-8 h-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm text-muted-foreground">Enter a match value to see preview</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border text-foreground/80">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formMatchValue || !formCategoryId}
              className="bg-primary hover:bg-primary"
            >
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRule}
        title="Delete Rule"
        description={`Are you sure you want to delete the rule "${deleteTarget?.matchValue}"? This cannot be undone.`}
      />

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a custom category for your rules
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Category Name</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Gifts, Mutual Funds, Salary"
                className="bg-muted border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Category Type</label>
              <Select
                value={categoryType}
                onValueChange={(v) => setCategoryType((v as 'expense' | 'investment' | 'income' | 'transfer') || 'expense')}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="expense" className="text-foreground/90">
                    Expense (Default)
                  </SelectItem>
                  <SelectItem value="investment" className="text-foreground/90">
                    Investment / Savings (Tracked separately in Invoices & Insights)
                  </SelectItem>
                  <SelectItem value="income" className="text-foreground/90">
                    Income
                  </SelectItem>
                  <SelectItem value="transfer" className="text-foreground/90">
                    Transfer
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      categoryColor === color ? "border-white scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Icon</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map(icon => (
                  <button
                    key={icon}
                    className={cn(
                      "w-8 h-8 rounded-md bg-muted flex items-center justify-center border-2 transition-all hover:bg-secondary",
                      categoryIcon === icon ? "border-primary bg-secondary" : "border-transparent"
                    )}
                    onClick={() => setCategoryIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
              className="border-border text-foreground/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!categoryName || categoryLoading}
              className="bg-primary hover:bg-primary"
            >
              {categoryLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Deletion / Remapping Dialog */}
      <Dialog
        open={!!deleteCategoryTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCategoryTarget(null)
            setCategoryUsage(null)
          }
        }}
      >
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              Delete Category
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {deleteCategoryTarget && (
                <span>
                  Deleting <strong className="text-foreground">{deleteCategoryTarget.name}</strong>
                  {deleteCategoryTarget.isSystem && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      system
                    </span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingCategoryUsage ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Checking assigned transactions and rules...</span>
            </div>
          ) : categoryUsage && categoryUsage.transactionCount > 0 ? (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm space-y-1">
                <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <span>⚠️</span> {categoryUsage.transactionCount} Transaction{categoryUsage.transactionCount > 1 ? 's' : ''} Affected
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  There are currently {categoryUsage.transactionCount} transaction{categoryUsage.transactionCount > 1 ? 's' : ''} categorized under &quot;{deleteCategoryTarget?.name}&quot;. Choose how you would like to handle them:
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Option 1: Remap */}
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors">
                  <input
                    type="radio"
                    name="categoryAction"
                    checked={reassignAction === 'remap'}
                    onChange={() => setReassignAction('remap')}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">Reassign to another category</div>
                      <div className="text-xs text-muted-foreground">Map all existing transactions to a different category</div>
                    </div>
                    {reassignAction === 'remap' && (
                      <Select
                        value={categoryRemapTargetId}
                        onValueChange={(val) => setCategoryRemapTargetId(val || '')}
                      >
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Select target category" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {categories
                            .filter(c => c.id !== deleteCategoryTarget?.id)
                            .map(cat => (
                              <SelectItem key={cat.id} value={cat.id} label={cat.name}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span>{cat.name}</span>
                                  {cat.type && cat.type !== 'expense' && (
                                    <span className="text-[10px] px-1 py-0.2 rounded font-mono text-muted-foreground uppercase">
                                      {cat.type}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </label>

                {/* Option 2: Uncategorized */}
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors">
                  <input
                    type="radio"
                    name="categoryAction"
                    checked={reassignAction === 'uncategorize'}
                    onChange={() => setReassignAction('uncategorize')}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Move to Uncategorized</div>
                    <div className="text-xs text-muted-foreground">Reset these transactions to Uncategorized status</div>
                  </div>
                </label>
              </div>

              {categoryUsage.ruleCount > 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Note: {categoryUsage.ruleCount} categorization rule{categoryUsage.ruleCount > 1 ? 's' : ''} pointing to this category will also be updated.
                </p>
              )}
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{deleteCategoryTarget?.name}</strong>?
              {categoryUsage && categoryUsage.transactionCount === 0 && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  This category has no assigned transactions.
                </span>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteCategoryTarget(null)}
              disabled={deletingCategory}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteCategory}
              disabled={
                Boolean(
                  deletingCategory ||
                  loadingCategoryUsage ||
                  (categoryUsage && categoryUsage.transactionCount > 0 && reassignAction === 'remap' && !categoryRemapTargetId)
                )
              }
            >
              {deletingCategory ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : categoryUsage && categoryUsage.transactionCount > 0 ? (
                'Reassign & Delete'
              ) : (
                'Delete Category'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


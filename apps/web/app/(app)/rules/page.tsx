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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  isSystem: boolean
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
        ? 'bg-zinc-900 border-zinc-800'
        : 'bg-zinc-900/50 border-zinc-800 opacity-60'
    )}>
      {/* Priority */}
      <div className="w-10 text-center">
        <span className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-zinc-800 text-xs font-mono text-zinc-400">
          {rule.priority}
        </span>
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 text-sm">
        <div className="text-zinc-400 capitalize">{rule.matchField}</div>
        <div className="text-zinc-400">{rule.matchType}</div>
        <div className="font-mono text-zinc-300 truncate" title={rule.matchValue}>
          {rule.matchValue}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

      {/* Category */}
      <div className="w-36 flex items-center gap-2">
        {rule.category && (
          <>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: rule.category.color }}
            />
            <span className="text-zinc-300 text-sm truncate">
              {rule.category.name}
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isSystem ? (
          <Lock className="w-4 h-4 text-zinc-600" />
        ) : (
          <>
            <Switch
              checked={rule.isActive}
              onCheckedChange={(checked) => onToggle(rule, checked)}
              className="data-[state=checked]:bg-indigo-500"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
              onClick={() => onEdit(rule)}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-rose-400"
              onClick={() => onDelete(rule)}
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
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
  const [categoryColor, setCategoryColor] = useState('#6366f1')
  const [categoryIcon, setCategoryIcon] = useState('📂')
  const [categoryLoading, setCategoryLoading] = useState(false)

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

  // Fetch preview when form changes
  useEffect(() => {
    if (!formMatchValue || !formCategoryId) {
      setPreview(null)
      return
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      try {
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

  const handleSave = () => {
    const data = {
      matchField: formMatchField,
      matchType: formMatchType,
      matchValue: formMatchValue,
      categoryId: formCategoryId,
      priority: formPriority,
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
      await apiClient.fetch('/v1/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryName.trim(),
          color: categoryColor,
          icon: categoryIcon,
        }),
      })
      toast.success('Category created')
      setCategoryName('')
      setCategoryDialogOpen(false)
      fetchData()
    } catch (err) {
      console.error('Failed to create category:', err)
      toast.error('Failed to create category')
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (cat.isSystem) return
    try {
      await apiClient.fetch(`/v1/categories/${cat.id}`, {
        method: 'DELETE',
      })
      toast.success('Category deleted')
      fetchData()
    } catch (err) {
      console.error('Failed to delete category:', err)
      toast.error('Failed to delete category')
    }
  }


  const handleDeleteRule = async () => {
    if (!deleteTarget) return
    try {
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
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Loading rules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Rules</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Auto-categorize transactions based on patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 gap-2"
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
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my-rules" className="w-full">
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="my-rules" className="data-[state=active]:bg-zinc-700">
            My Rules ({userRules.length})
          </TabsTrigger>
          <TabsTrigger value="system-rules" className="data-[state=active]:bg-zinc-700">
            System Rules ({systemRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-rules" className="mt-4 space-y-3">
          {userRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-xl">
              <Sliders className="w-10 h-10 text-zinc-600 mb-3" />
              <h3 className="text-zinc-300 font-medium mb-1">No custom rules yet</h3>
              <p className="text-sm text-zinc-500 max-w-sm mb-4">
                Create rules like &quot;description contains NETFLIX → Subscriptions&quot; to auto-categorize transactions
              </p>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreateDialog}>
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
          <p className="text-sm text-zinc-500 mb-4">
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
      <div className="mt-8 pt-6 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-50">Categories</h2>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 gap-2 h-8"
            onClick={() => setCategoryDialogOpen(true)}
          >
            <Plus className="w-3 h-3" />
            New Category
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">

          {categories.map(cat => (
            <div
              key={cat.id}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
                cat.isSystem
                  ? 'bg-zinc-800 text-zinc-300'
                  : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700'
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
              {cat.isSystem ? (
                <Lock className="w-3 h-3 text-zinc-600" />
              ) : (
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="hover:text-rose-400 transition-colors ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>


      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) setEditingRule(null)
      }}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Define a pattern to automatically categorize transactions
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              {/* Match Field */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Match Field</label>
                <Select value={formMatchField} onValueChange={(v) => setFormMatchField(v || 'description')}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue>
                      {formMatchField === 'description' && 'Description'}
                      {formMatchField === 'merchant' && 'Merchant'}
                      {formMatchField === 'amount' && 'Amount'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="description" className="text-zinc-200">Description</SelectItem>
                    <SelectItem value="merchant" className="text-zinc-200">Merchant</SelectItem>
                    <SelectItem value="amount" className="text-zinc-200">Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Type */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Match Type</label>
                <Select value={formMatchType} onValueChange={(v) => setFormMatchType(v || 'contains')}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue>
                      {formMatchType === 'contains' && 'Contains'}
                      {formMatchType === 'equals' && 'Equals'}
                      {formMatchType === 'regex' && 'Regex'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="contains" className="text-zinc-200">Contains</SelectItem>
                    <SelectItem value="equals" className="text-zinc-200">Equals</SelectItem>
                    <SelectItem value="regex" className="text-zinc-200">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Value */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Match Value</label>
                <Input
                  value={formMatchValue}
                  onChange={(e) => setFormMatchValue(e.target.value)}
                  placeholder={formMatchType === 'regex' ? '.*NETFLIX.*' : 'NETFLIX'}
                  className="bg-zinc-800 border-zinc-700 font-mono"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Assign Category</label>
                <Select value={formCategoryId} onValueChange={(v) => v && setFormCategoryId(v)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue>
                      {categories.find(c => c.id === formCategoryId)?.name || 'Select Category'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id} className="flex items-center gap-2">
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
                <label className="text-sm text-zinc-400">Priority (1-999)</label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 100)}
                  className="bg-zinc-800 border-zinc-700 w-24"
                />
                <p className="text-xs text-zinc-500">
                  Lower = higher priority. User rules override system rules.
                </p>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="bg-zinc-950 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Preview</span>
                {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
              </div>

              {previewLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : preview ? (
                <>
                  <p className="text-sm">
                    <span className="font-semibold text-zinc-200">{preview.count}</span>
                    <span className="text-zinc-500"> transactions would match</span>
                  </p>
                  {preview.samples.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Sample matches</p>
                      {preview.samples.slice(0, 3).map(txn => (
                        <div
                          key={txn.id}
                          className="text-xs bg-zinc-900 rounded p-2 flex justify-between"
                        >
                          <span className="text-zinc-400 truncate flex-1">{txn.description}</span>
                          <span className="text-zinc-500 font-mono ml-2">
                            ₹{parseFloat(txn.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center">
                  <Search className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-500">Enter a match value to see preview</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formMatchValue || !formCategoryId}
              className="bg-indigo-600 hover:bg-indigo-700"
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
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Create a custom category for your rules
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Category Name</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Gifts, Hobbies"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Color</label>
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
              <label className="text-sm text-zinc-400">Icon</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map(icon => (
                  <button
                    key={icon}
                    className={cn(
                      "w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center border-2 transition-all hover:bg-zinc-700",
                      categoryIcon === icon ? "border-indigo-500 bg-zinc-750" : "border-transparent"
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
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!categoryName || categoryLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {categoryLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


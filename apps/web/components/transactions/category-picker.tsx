'use client'

import { useEffect, useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { CategoryBadge } from '@/components/ui/custom/CategoryBadge'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  type?: 'expense' | 'investment' | 'income' | 'transfer'
  isSystem?: boolean
}

interface CategoryPickerProps {
  categoryId: string | null
  category: { id: string | null; name: string; color?: string | null; type?: string | null } | null
  onUpdate: (categoryId: string | null) => Promise<void>
}

export function CategoryPicker({ categoryId, category, onUpdate }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [typeTab, setTypeTab] = useState<'all' | 'expense' | 'investment' | 'income' | 'transfer'>('all')

  useEffect(() => {
    if (open && categories.length === 0) {
      ;(async () => {
        try {
          const { useVaultStore } = await import('@/lib/store/vault.store')
          if (useVaultStore.getState().isUnlocked()) {
            const { loadReferenceMerged } = await import('@/lib/engine/reference')
            setCategories((await loadReferenceMerged('categories', () => apiClient.fetch<Category[]>('/v1/categories'))) as Category[])
            return
          }
        } catch {
          // fall through to server
        }
        apiClient.fetch<Category[]>('/v1/categories').then(setCategories).catch(console.error)
      })()
    }
  }, [open, categories.length])

  const filtered = categories.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const itemType = item.type ?? 'expense'
    const matchesType = typeTab === 'all' || itemType === typeTab
    return matchesSearch && matchesType
  })

  const handleSelect = async (selected: Category | null) => {
    setOpen(false)
    await onUpdate(selected?.id ?? null)
  }

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
      })
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="cursor-pointer hover:opacity-80 transition-opacity">
        {category ? (
          <div className="flex items-center gap-1.5">
            <CategoryBadge name={category.name} color={category.color ?? '#6366f1'} />
            {category.type && category.type !== 'expense' && (
              <span className={cn(
                "text-[9px] px-1 py-0.2 rounded font-medium uppercase",
                category.type === 'investment' ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
                category.type === 'income' ? "bg-sky-500/15 text-sky-300 border border-sky-500/30" :
                "bg-purple-500/15 text-purple-300 border border-purple-500/30"
              )}>
                {category.type === 'investment' ? '📈 Invest' : category.type}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors">
            — Uncategorized
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-2 bg-card border-border" 
        align="start"
      >
        <Input
          ref={inputRef}
          placeholder="Search categories…"
          className="mb-2 h-8 bg-muted border-border text-sm text-foreground/90"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1 mb-2 p-0.5 bg-muted/60 rounded-md text-[11px]">
          <button
            type="button"
            onClick={() => setTypeTab('all')}
            className={cn(
              'flex-1 py-1 px-1 rounded transition-colors text-center font-medium',
              typeTab === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('expense')}
            className={cn(
              'flex-1 py-1 px-1 rounded transition-colors text-center font-medium',
              typeTab === 'expense' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('investment')}
            className={cn(
              'flex-1 py-1 px-1 rounded transition-colors text-center font-medium',
              typeTab === 'investment' ? 'bg-background text-emerald-300 shadow-xs' : 'text-muted-foreground hover:text-emerald-400'
            )}
          >
            Investments
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('income')}
            className={cn(
              'flex-1 py-1 px-1 rounded transition-colors text-center font-medium',
              typeTab === 'income' ? 'bg-background text-sky-300 shadow-xs' : 'text-muted-foreground hover:text-sky-400'
            )}
          >
            Income
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          <button
            onClick={() => void handleSelect(null)}
            className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
          >
            — Uncategorized
          </button>
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => void handleSelect(item)}
              className={cn(
                'w-full text-left flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors',
                categoryId === item.id
                  ? 'bg-muted text-foreground'
                  : 'text-foreground/80 hover:bg-muted'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </div>
              {item.type && item.type !== 'expense' && (
                <span className={cn(
                  "text-[9px] px-1 py-0.2 rounded font-medium uppercase shrink-0",
                  item.type === 'investment' ? "bg-emerald-500/15 text-emerald-300" :
                  item.type === 'income' ? "bg-sky-500/15 text-sky-300" : "bg-purple-500/15 text-purple-300"
                )}>
                  {item.type}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground/70 px-2 py-2">No categories found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

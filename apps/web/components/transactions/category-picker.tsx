'use client'

import { useEffect, useState } from 'react'
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
  isSystem?: boolean
}

interface CategoryPickerProps {
  categoryId: string | null
  category: { id: string | null; name: string; color?: string | null } | null
  onUpdate: (categoryId: string | null) => Promise<void>
}

export function CategoryPicker({ categoryId, category, onUpdate }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open && categories.length === 0) {
      apiClient.fetch<Category[]>('/v1/categories').then(setCategories).catch(console.error)
    }
  }, [open, categories.length])

  const filtered = categories.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = async (selected: Category | null) => {
    setOpen(false)
    await onUpdate(selected?.id ?? null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="cursor-pointer hover:opacity-80 transition-opacity">
        {category ? (
          <CategoryBadge name={category.name} color={category.color ?? '#6366f1'} />
        ) : (
          <span className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            — Uncategorized
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-zinc-900 border-zinc-800" align="start">
        <Input
          placeholder="Search categories…"
          className="mb-2 h-8 bg-zinc-800 border-zinc-700 text-sm text-zinc-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          <button
            onClick={() => void handleSelect(null)}
            className="w-full text-left px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-800 rounded transition-colors"
          >
            — Uncategorized
          </button>
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => void handleSelect(item)}
              className={cn(
                'w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors',
                categoryId === item.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-zinc-600 px-2 py-2">No categories found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

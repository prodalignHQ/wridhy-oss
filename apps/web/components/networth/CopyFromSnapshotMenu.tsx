'use client'

import { useState } from 'react'
import { CalendarClock, ChevronDown, Check } from 'lucide-react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Snapshot {
  id: string
  snapshotDate: string | Date
  totalAssets: string | number
  netWorth: string | number
}

interface CopyFromSnapshotMenuProps {
  snapshots: Snapshot[]
  onCopy: (snapshotId: string) => Promise<void>
  disabled?: boolean
}

export function CopyFromSnapshotMenu({ snapshots, onCopy, disabled }: CopyFromSnapshotMenuProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCopy = async (id: string) => {
    setLoading(id)
    try {
      await onCopy(id)
    } finally {
      setLoading(null)
    }
  }

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || snapshots.length === 0}
      className="border-zinc-700 text-zinc-400 hover:text-zinc-50 hover:border-zinc-600 gap-1.5"
    >
      <CalendarClock size={14} />
      Copy from previous
      <ChevronDown size={13} />
    </Button>
  )

  if (snapshots.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-xs">
            Save your first snapshot to enable this
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align="end"
        className="bg-zinc-900 border-zinc-800 text-zinc-200 min-w-[220px]"
      >
        <p className="text-xs text-zinc-500 px-3 py-1.5">Load values from a past snapshot</p>
        {[...snapshots].reverse().map((snap) => (
          <DropdownMenuItem
            key={snap.id}
            onClick={() => handleCopy(snap.id)}
            disabled={loading === snap.id}
            className="flex items-center justify-between cursor-pointer focus:bg-zinc-800"
          >
            <div>
              <p className="text-sm">
                {format(new Date(snap.snapshotDate), 'dd MMM yyyy')}
              </p>
              <p className="text-xs text-zinc-500 font-mono">
                NW: {Number(snap.netWorth) >= 0 ? '+' : ''}
                {parseFloat(snap.netWorth as string).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            {loading === snap.id && (
              <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

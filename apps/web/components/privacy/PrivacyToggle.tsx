'use client'

import { useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/lib/store/ui.store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const emptySubscribe = () => () => {}

export function PrivacyToggle({ isCollapsed }: { isCollapsed?: boolean }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const isPrivacyMode = useUIStore((state) => state.isPrivacyMode)
  const togglePrivacyMode = useUIStore((state) => state.togglePrivacyMode)

  const handleToggle = () => {
    const next = !isPrivacyMode
    togglePrivacyMode()
    if (next) {
      toast.success('Privacy mode active — numbers masked for screenshots', {
        id: 'privacy-toast',
        duration: 2500,
      })
    } else {
      toast.info('Privacy mode disabled — numbers unmasked', {
        id: 'privacy-toast',
        duration: 2500,
      })
    }
  }

  const active = mounted ? isPrivacyMode : false

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <button
            type="button"
            aria-label="Toggle privacy mode"
            onClick={handleToggle}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 cursor-pointer',
              active
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'border-border bg-muted text-foreground hover:bg-secondary'
            )}
          >
            {active ? <EyeOff className="h-4 w-4 text-amber-500" /> : <Eye className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium text-xs">
          {active ? 'Privacy mode: Active (Alt+P)' : 'Privacy mode: Off (Alt+P)'}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Privacy Mode</p>
        <p className="text-xs text-muted-foreground">
          {active ? 'Numbers masked' : 'Numbers visible'}
        </p>
      </div>
      <button
        type="button"
        aria-label="Toggle privacy mode"
        onClick={handleToggle}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
          active
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
            : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        {active ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <EyeOff className="h-3.5 w-3.5" />
            <span>Masked</span>
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" />
            <span>Mask</span>
          </>
        )}
      </button>
    </div>
  )
}

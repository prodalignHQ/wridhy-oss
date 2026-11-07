'use client'

import { useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/lib/store/ui.store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PrivacyFlipProps {
  className?: string
  variant?: 'default' | 'compact' | 'icon'
  showShortcut?: boolean
}

const emptySubscribe = () => () => {}

export function PrivacyFlip({
  className,
  variant = 'default',
  showShortcut = true,
}: PrivacyFlipProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const isPrivacyMode = useUIStore((state) => state.isPrivacyMode)
  const togglePrivacyMode = useUIStore((state) => state.togglePrivacyMode)

  const handleToggle = () => {
    const nextState = !isPrivacyMode
    togglePrivacyMode()
    if (nextState) {
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

  const button = (
    <button
      type="button"
      aria-label={active ? 'Disable privacy mode' : 'Enable privacy mode'}
      aria-pressed={active}
      onClick={handleToggle}
      className={cn(
        'group relative inline-flex items-center justify-center font-medium transition-all duration-200 select-none cursor-pointer',
        variant === 'icon'
          ? 'h-9 w-9 rounded-xl border p-0'
          : variant === 'compact'
          ? 'h-8 px-2.5 rounded-xl border text-xs gap-1.5'
          : 'h-9 px-3 rounded-xl border text-xs gap-2 shadow-2xs',
        active
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15'
          : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        className
      )}
    >
      {active ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <EyeOff size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          {variant !== 'icon' && (
            <span className="font-semibold tracking-tight">Masked</span>
          )}
        </>
      ) : (
        <>
          <Eye
            size={14}
            className="text-muted-foreground/80 group-hover:text-foreground transition-colors shrink-0"
          />
          {variant !== 'icon' && (
            <span className="tracking-tight">Mask Numbers</span>
          )}
        </>
      )}

      {variant === 'default' && showShortcut && (
        <kbd className="hidden xl:inline-flex items-center rounded border border-border/80 bg-background/60 px-1 text-[10px] text-muted-foreground/80 font-mono ml-0.5">
          ⌥P
        </kbd>
      )}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom" className="text-xs font-medium max-w-xs">
        {active
          ? 'Privacy mode active (Alt+P) — Click to reveal numbers'
          : 'Privacy mode (Alt+P) — Mask numbers for safe screenshots'}
      </TooltipContent>
    </Tooltip>
  )
}

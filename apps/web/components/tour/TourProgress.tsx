'use client'

// ─── Tour progress rail ──────────────────────────────────────────────────────
// A thin fill that eases toward its new width plus a dot per step. The dots
// are the "you are here" anchor; the fill is the only element that moves
// between steps, so it carries the sense of forward motion on its own.

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TourProgressProps {
  /** Full ordered step sequence currently in play. */
  steps: readonly string[]
  /** Index into `steps`. */
  current: number
  className?: string
}

export function TourProgress({ steps, current, className }: TourProgressProps) {
  const total = steps.length
  // The fill reaches the last dot's centre, not the track edge, so "done"
  // only reads as true once the final step itself has been reached.
  const pct = total <= 1 ? 0 : (current / (total - 1)) * 100

  return (
    <div className={cn('w-full', className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-label={`Step ${current + 1} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <span key={step} className="flex items-center">
              {i > 0 && (
                <span
                  className={cn(
                    'h-px w-6 transition-colors duration-500 sm:w-10',
                    done ? 'bg-primary/50' : 'bg-border'
                  )}
                />
              )}
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-500',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-primary/15 text-primary ring-4 ring-primary/10',
                  !done && !active && 'border-border text-muted-foreground/60'
                )}
              >
                {done ? (
                  <Check
                    size={11}
                    strokeWidth={3}
                    className={cn(i === current - 1 && 'animate-tour-pop motion-reduce:animate-none')}
                  />
                ) : (
                  i + 1
                )}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

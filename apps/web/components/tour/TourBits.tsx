'use client'

// ─── Tour microanimation primitives ──────────────────────────────────────────
// Small presentational pieces shared by the setup steps. Each one earns
// its keep by making a state change legible: something appeared, something
// is now satisfied, something is waiting on you.

import type { ReactNode } from 'react'
import { Check, EyeOff, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The vault emblem: a slow expanding halo behind a shield that pops in once.
 * The halo is the "this is still waiting on you" signal while a step is idle.
 */
export function TourShield({
  tone = 'primary',
  className,
}: {
  tone?: 'primary' | 'amber' | 'emerald'
  className?: string
}) {
  const ring =
    tone === 'amber'
      ? 'bg-amber-500/25'
      : tone === 'emerald'
        ? 'bg-emerald-500/25'
        : 'bg-primary/25'
  const ink =
    tone === 'amber'
      ? 'text-amber-500'
      : tone === 'emerald'
        ? 'text-emerald-500'
        : 'text-primary'
  const chip =
    tone === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30'
      : tone === 'emerald'
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-primary/10 border-primary/25'

  return (
    <div className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center', className)}>
      <span
        className={cn(
          'absolute inset-0 rounded-full animate-tour-halo motion-reduce:animate-none',
          ring
        )}
        aria-hidden
      />
      <span
        className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-2xl border',
          chip,
          ink
        )}
      >
        <ShieldCheck
          size={26}
          className="animate-tour-pop motion-reduce:animate-none"
          strokeWidth={1.75}
        />
      </span>
    </div>
  )
}

/**
 * What the server actually holds, shown as scrambled hex next to the real
 * label. This is the whole "the server sees nothing" argument in one glance:
 * no jargon, just the reader's own data sitting next to gibberish. The sweep
 * implies "scrambled" without animating anything legible.
 */
export function ServerSeesNothing() {
  const rows = [
    { label: 'Your balance', junk: '8f3a9c2b71e4' },
    { label: 'Your transactions', junk: '41be07af9c22' },
    { label: 'Your statements', junk: 'd07c3ea5b148' },
  ]
  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 p-3.5 text-left">
      <div className="flex items-center gap-2">
        <EyeOff size={13} className="text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          What our servers store
        </p>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="animate-in fade-in-0 slide-in-from-left-1 flex items-baseline justify-between gap-3 motion-reduce:animate-none"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="text-xs text-foreground">{row.label}</span>
            <span className="bg-gradient-to-r from-muted-foreground/15 via-muted-foreground/70 to-muted-foreground/15 bg-[length:200%_100%] font-mono text-[11px] tracking-wider text-muted-foreground animate-tour-shimmer motion-reduce:animate-none">
              {row.junk}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Scrambled before it leaves your device. No amounts, no names, no way for us — or anyone who copies our
        database — to read it.
      </p>
    </div>
  )
}

/**
 * A single pass/fail condition. Satisfied chips flip to emerald with a one
 * shot pop; unmet ones sit quietly grey. Cheap, but it turns "typing a
 * password" into a task with visible progress.
 */
export function RequirementChip({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-300',
        met
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-border bg-muted/40 text-muted-foreground/80'
      )}
    >
      <span
        className={cn(
          'flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-300',
          met ? 'bg-emerald-500 text-white' : 'bg-border'
        )}
      >
        {met ? (
          <Check
            size={9}
            strokeWidth={4}
            className="animate-tour-pop motion-reduce:animate-none"
          />
        ) : (
          <span className="h-1 w-1 rounded-full bg-background/60" />
        )}
      </span>
      {label}
    </span>
  )
}

/**
 * Staggered entrance. Children fade and rise in sequence, which is what makes
 * a list of plain copy feel like it is being revealed rather than dumped.
 * `index` is the child's position; `base` is the delay step in ms.
 */
export function Stagger({
  index = 0,
  base = 60,
  step = 14,
  className,
  children,
}: {
  index?: number
  base?: number
  step?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none',
        className
      )}
      style={{ animationDelay: `${base + index * step}ms` }}
    >
      {children}
    </div>
  )
}

'use client'

// ─── Guided tour ─────────────────────────────────────────────────────────────
// Interactive walkthrough of the setup flow: accounts → household →
// statements → rules → transactions → invoices → insights. Left rail is the
// step list (with persisted checkmarks), right panel is the active step with
// an animated mock-up, how-to bullets, and a link into the real section.

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, RotateCcw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GUIDE_STEPS } from '@/lib/guide-content'
import { useGuideStore } from '@/lib/store/guide.store'
import { GuideIllustration } from '@/components/guide/GuideIllustration'
import { PageHelp } from '@/components/guide/PageHelp'

export function GuideTour({ initialIndex }: { initialIndex: number }) {
  const [index, setIndex] = useState(initialIndex)
  const { done, toggle, reset } = useGuideStore()
  const step = GUIDE_STEPS[index]!
  const StepIcon = step.icon
  const isLast = index === GUIDE_STEPS.length - 1

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(GUIDE_STEPS.length - 1, next)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-semibold text-foreground">Getting Started</h1>
            <PageHelp section="dashboard" />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Follow these {GUIDE_STEPS.length} steps in order — {done.length} of {GUIDE_STEPS.length} done.
          </p>
        </div>
        {done.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
            <RotateCcw size={13} /> Start over
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(done.length / GUIDE_STEPS.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Step list */}
        <ol className="space-y-1">
          {GUIDE_STEPS.map((s, i) => {
            const finished = done.includes(s.id)
            const active = i === index
            const SIcon = s.icon
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      finished
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : active
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    {finished ? <Check size={13} /> : <SIcon size={13} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {i + 1}. {s.title}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* Active step */}
        <div key={step.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <StepIcon size={20} />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{step.tagline}</p>
                <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-foreground/90">{step.description}</p>

            <div className="mt-4">
              <GuideIllustration stepId={step.id} />
            </div>

            <ul className="mt-4 space-y-1.5 rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90">
              {step.bullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0} className="gap-1.5">
                <ArrowLeft size={14} /> Back
              </Button>
              <Button
                variant={done.includes(step.id) ? 'outline' : 'secondary'}
                onClick={() => toggle(step.id)}
                className="gap-1.5"
              >
                <Check size={14} /> {done.includes(step.id) ? 'Done — undo' : 'Mark as done'}
              </Button>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" className="gap-1.5" render={<Link href={step.href} />}>
                  {step.cta} <ExternalLink size={14} />
                </Button>
                {!isLast ? (
                  <Button onClick={() => go(index + 1)} className="gap-1.5">
                    Next step <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Button className="gap-1.5" render={<Link href={step.href} />}>
                    Finish — {step.cta.toLowerCase()} <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Cross-link: section-specific help also lives on the ? icon */}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Every page has a <span className="font-semibold text-foreground">?</span> next to its title
            with a quick refresher — this tour is always here in the sidebar under Guide.
          </p>
        </div>
      </div>
    </div>
  )
}

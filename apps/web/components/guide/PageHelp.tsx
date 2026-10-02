'use client'

// ─── Per-section "?" helper ──────────────────────────────────────────────────
// Sits next to a page's <h1> and opens a short explainer: what the section
// does, how to use it, and where it fits in the guided tour. Usage:
//
//   import { PageHelp } from '@/components/guide/PageHelp'
//   <h1 …>Accounts</h1>  →  <div className="flex items-center gap-1.5">
//                              <h1 …>Accounts</h1><PageHelp section="accounts" />
//                            </div>

import { useState } from 'react'
import Link from 'next/link'
import { CircleHelp, ArrowRight, Route } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GUIDE_PATH, SECTION_HELP, type SectionKey } from '@/lib/guide-content'

export function PageHelp({ section }: { section: SectionKey }) {
  const [open, setOpen] = useState(false)
  const help = SECTION_HELP[section]
  const Icon = help.icon

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`What is ${help.title}?`}
        aria-label={`What is ${help.title}?`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <CircleHelp size={16} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={18} />
              </span>
              <DialogTitle className="text-lg">{help.title}</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-left leading-relaxed">
              {help.what}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed text-foreground/90">
            {help.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            {help.guideStepId && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                render={<Link href={`${GUIDE_PATH}?step=${help.guideStepId}`} onClick={() => setOpen(false)} />}
              >
                <Route size={14} /> See it in the tour
              </Button>
            )}
            {help.next && (
              <Button size="sm" className="flex-1" render={<Link href={help.next.href} onClick={() => setOpen(false)} />}>
                {help.next.label} <ArrowRight size={14} />
              </Button>
            )}
          </div>

          {!help.guideStepId && !help.next && (
            <p className="text-xs text-muted-foreground">
              See the{' '}
              <Link href={GUIDE_PATH} className="underline underline-offset-2 hover:text-foreground">
                guided tour
              </Link>{' '}
              for the full setup flow.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

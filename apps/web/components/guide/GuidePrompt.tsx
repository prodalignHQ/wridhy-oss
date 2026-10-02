'use client'

// ─── Post-setup tour nudge ───────────────────────────────────────────────────
// Self-contained one-time prompt shown on the dashboard after the account is
// set up (vault ceremony resolved: completed or skipped — plus local mode,
// where there is no ceremony). Shows only when the user has never engaged
// with the guide (nothing marked done) and hasn't dismissed this prompt.
// Any close path counts as a dismissal: it never nags twice.

import Link from 'next/link'
import { Route, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GUIDE_PATH, GUIDE_STEPS } from '@/lib/guide-content'
import { useTourStore } from '@/lib/store/tour.store'
import { useGuideStore } from '@/lib/store/guide.store'
import { isLocalMode } from '@/lib/local-mode'

export function GuidePrompt() {
  const tourStatus = useTourStore((s) => s.status)
  const done = useGuideStore((s) => s.done)
  const promptDismissed = useGuideStore((s) => s.promptDismissed)
  const dismissPrompt = useGuideStore((s) => s.dismissPrompt)

  const setupResolved = isLocalMode() || tourStatus === 'completed' || tourStatus === 'skipped'
  const open = setupResolved && done.length === 0 && !promptDismissed

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismissPrompt()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Route size={18} />
            </span>
            <DialogTitle className="text-lg">You&apos;re set up — take the tour?</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-left leading-relaxed">
            MoMoney works best in order: accounts, household, statements, rules, transactions,
            invoices, insights, net worth. The guided tour walks through all {GUIDE_STEPS.length}{' '}
            steps with a live example of each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            className="flex-1"
            render={<Link href={GUIDE_PATH} onClick={dismissPrompt} />}
          >
            Start the tour <ArrowRight size={14} />
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={dismissPrompt}>
            Maybe later
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can always find it later in the sidebar under Guide.
        </p>
      </DialogContent>
    </Dialog>
  )
}

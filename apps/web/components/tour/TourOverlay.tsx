'use client'

// ─── Modal shell for vault setup ─────────────────────────────────────────────
// The tour is a ceremony, not a page. The whole point of this shell is that
// "ignore it and go look at invoices" stops being available: a scrim covers
// the app, the scrim is its own scroll container (so the wheel cannot reach
// the dashboard underneath), body scrolling is locked, and focus is trapped.
//
// Escape and a scrim click both mean "skip for now" — the same durable
// decision as the visible button, never a silent no-op that leaves the tour
// half-open.

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function TourOverlay({
  onDismiss,
  /** Changing this re-runs the autofocus. Pass the step id: React unmounts the
   *  previous step's controls on advance, so without this focus falls to
   *  <body> and a keyboard user loses their place on every single step. */
  focusKey,
  children,
  className,
}: {
  /** Escape / scrim click. Callers treat this as an explicit skip. */
  onDismiss: () => void
  focusKey?: string | number
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Lock the document. The app shell's <main> scrolls independently, which is
  // why the scrim below is a scroll container in its own right.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Start the keyboard on the step's primary action rather than the document.
    // `tabIndex >= 0` is what keeps the full-bleed scrim button (tabIndex -1,
    // deliberately out of the tab order) from being the first thing focused —
    // otherwise a stray Enter would skip the whole tour.
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.tabIndex >= 0 && (el.offsetWidth > 0 || el.offsetHeight > 0)
      )
    focusables()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      // Anything outside the dialog (including the covered sidebar) counts as
      // "before the first item", so focus wraps into the trap either way.
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss, focusKey])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
    >
      {/* Backdrop: blur + dim so it reads as "the app is waiting", not a crash. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Skip vault setup"
        onClick={onDismiss}
        className="fixed inset-0 h-full w-full cursor-default animate-in fade-in-0 bg-background/85 backdrop-blur-sm duration-300 motion-reduce:animate-none"
      />
      <div className="relative flex min-h-full items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className={cn('w-full max-w-lg', className)}>{children}</div>
      </div>
    </div>
  )
}

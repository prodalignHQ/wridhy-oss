'use client'

// ─── Animated step illustrations ─────────────────────────────────────────────
// Lightweight CSS mock-ups of what each section looks like — no screenshots
// to go stale, no image assets. Each mock replays its enter animation when
// the step changes (parent keys on the step id) using the project's
// tailwind `animate-in` utilities plus staggered delays.

import { FileUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-rose-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function AccountsMock() {
  const cards = [
    { name: 'HDFC Savings', type: 'Bank', tint: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
    { name: 'ICICI Platinum', type: 'Credit Card', tint: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
    { name: 'Cash Wallet', type: 'Wallet', tint: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  ]
  return (
    <Frame label="Accounts">
      <div className="grid grid-cols-3 gap-2.5">
        {cards.map((c, i) => (
          <div
            key={c.name}
            style={{ animationDelay: `${i * 150}ms` }}
            className="animate-in fade-in-0 slide-in-from-bottom-3 rounded-lg border border-border bg-background p-2.5 duration-500"
          >
            <div className={cn('mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', c.tint)}>
              {c.name.slice(0, 1)}
            </div>
            <p className="truncate text-[11px] font-semibold text-foreground">{c.name}</p>
            <p className="text-[10px] text-muted-foreground">{c.type}</p>
          </div>
        ))}
      </div>
    </Frame>
  )
}

function HouseholdMock() {
  const members = [
    { n: 'Self', c: 'bg-primary/15 text-primary' },
    { n: 'Partner', c: 'bg-rose-500/15 text-rose-500' },
    { n: 'Mom', c: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  ]
  return (
    <Frame label="Household">
      <div className="flex items-center justify-center gap-3 py-2">
        {members.map((m, i) => (
          <div
            key={m.n}
            style={{ animationDelay: `${i * 150}ms` }}
            className="animate-in fade-in-0 zoom-in-95 flex flex-col items-center gap-1.5 duration-500"
          >
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold', m.c)}>
              {m.n.slice(0, 1)}
            </span>
            <span className="text-[11px] font-medium text-foreground">{m.n}</span>
          </div>
        ))}
        <div className="animate-in fade-in-0 ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border text-lg text-muted-foreground duration-500" style={{ animationDelay: '450ms' }}>
          +
        </div>
      </div>
    </Frame>
  )
}

function StatementsMock() {
  return (
    <Frame label="Statements · Upload">
      <div className="animate-in fade-in-0 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-center duration-500">
        <FileUp size={20} className="mx-auto mb-1.5 text-primary" />
        <p className="text-xs font-medium text-foreground">icici-credit-card.csv</p>
        <div className="mx-auto mt-2.5 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Parsed 84 · New 61 · Duplicates 23</p>
      </div>
    </Frame>
  )
}

function RulesMock() {
  return (
    <Frame label="Rules">
      <div className="space-y-2">
        {[
          { if: 'merchant contains “swiggy”', then: 'Food & Dining', delay: 0 },
          { if: 'merchant contains “uber”', then: 'Transport', delay: 150 },
        ].map((r) => (
          <div
            key={r.if}
            style={{ animationDelay: `${r.delay}ms` }}
            className="animate-in fade-in-0 slide-in-from-left-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] duration-500"
          >
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">IF</span>
            <span className="truncate font-medium text-foreground">{r.if}</span>
            <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
            <span className="ml-auto shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
              {r.then}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

function TransactionsMock() {
  const rows = [
    { d: 'Swiggy · Dinner', c: 'Food & Dining', amt: '−₹486', tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
    { d: 'Uber · Airport', c: 'Transport', amt: '−₹732', tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
    { d: 'Salary · Prodalign', c: 'Income', amt: '+₹85,000', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  ]
  return (
    <Frame label="Transactions">
      <div className="mb-2.5 flex gap-1.5">
        {['All', 'Self', 'Food'].map((f, i) => (
          <span
            key={f}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-medium',
              i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            )}
          >
            {f}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.d}
            style={{ animationDelay: `${i * 150}ms` }}
            className="animate-in fade-in-0 slide-in-from-bottom-2 flex items-center gap-2 rounded-lg bg-background px-2.5 py-2 duration-500"
          >
            <span className="truncate text-[11px] font-medium text-foreground">{r.d}</span>
            <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', r.tone)}>
              {r.c}
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-foreground">{r.amt}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

function InvoicesMock() {
  const splits = [
    { n: 'Self', pct: 62, c: 'bg-primary' },
    { n: 'Partner', pct: 38, c: 'bg-rose-400' },
  ]
  return (
    <Frame label="Invoices · March">
      <div className="animate-in fade-in-0 duration-500">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-semibold text-foreground">March household split</p>
          <p className="font-mono text-sm font-bold text-foreground">₹48,210</p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {splits.map((s, i) => (
            <div
              key={s.n}
              style={{ width: `${s.pct}%`, animationDelay: `${i * 200}ms` }}
              className={cn('animate-in slide-in-from-left-full h-full duration-700', s.c)}
            />
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {splits.map((s) => (
            <div key={s.n} className="flex items-center gap-2 text-[11px]">
              <span className={cn('h-2 w-2 rounded-full', s.c)} />
              <span className="font-medium text-foreground">{s.n}</span>
              <span className="ml-auto font-mono text-muted-foreground">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

function InsightsMock() {  const bars = [38, 55, 44, 70, 62, 88, 76]
  return (
    <Frame label="Insights · Spend by month">
      <div className="flex h-28 items-end justify-center gap-2 px-2">
        {bars.map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
            className={cn(
              'animate-in slide-in-from-bottom-full w-8 rounded-t-md duration-500',
              i === 5 ? 'bg-primary' : 'bg-primary/25'
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">March is your highest spend — mostly Food & Dining</p>
    </Frame>
  )
}

function NetWorthMock() {
  const rows = [
    { label: 'Assets', value: '₹12,40,000', pct: 100, bar: 'bg-emerald-500', delay: 0 },
    { label: 'Liabilities', value: '₹3,15,000', pct: 25, bar: 'bg-rose-400', delay: 200 },
  ]
  return (
    <Frame label="Net Worth">
      <div className="animate-in fade-in-0 space-y-2.5 duration-500">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-foreground">Household net worth</p>
          <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">₹9,25,000</p>
        </div>
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="font-mono text-muted-foreground">{r.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                style={{ width: `${r.pct}%`, animationDelay: `${r.delay}ms` }}
                className={cn('animate-in slide-in-from-left-full h-full rounded-full duration-700', r.bar)}
              />
            </div>
          </div>
        ))}
        <p className="pt-0.5 text-center text-[11px] text-muted-foreground">▲ ₹42,000 since last snapshot</p>
      </div>
    </Frame>
  )
}

export function GuideIllustration({ stepId }: { stepId: string }) {
  switch (stepId) {
    case 'accounts':
      return <AccountsMock />
    case 'household':
      return <HouseholdMock />
    case 'statements':
      return <StatementsMock />
    case 'rules':
      return <RulesMock />
    case 'transactions':
      return <TransactionsMock />
    case 'invoices':
      return <InvoicesMock />
    case 'insights':
      return <InsightsMock />
    case 'networth':
      return <NetWorthMock />
    default:
      return null
  }
}

"use client"

import { useState } from "react"
import {
  Layers,
  FileSpreadsheet,
  Tags,
  Users,
  FileText,
  TrendingUp,
  PieChart,
  Landmark,
  BriefcaseBusiness,
  ArrowRight,
} from "lucide-react"

export default function Features() {
  const [activeGroup, setActiveGroup] = useState<"all" | "input" | "household" | "growth">("all")

  return (
    <section id="features" className="scroll-mt-16 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary/80 dark:text-sky-300">
            Capability &amp; Scope
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Wridhy doesn&apos;t crowd your screen with crypto tickers or credit card ads.
            It gives you nine focused tools built specifically for real household finance.
          </p>

          {/* Group Filter Pills */}
          <div className="mt-8 inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveGroup("all")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeGroup === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All 9 Tools
            </button>
            <button
              type="button"
              onClick={() => setActiveGroup("input")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeGroup === "input"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              A. Ingestion &amp; Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveGroup("household")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeGroup === "household"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              B. Household &amp; Reports
            </button>
            <button
              type="button"
              onClick={() => setActiveGroup("growth")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeGroup === "growth"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              C. Growth &amp; Salary
            </button>
          </div>
        </div>

        {/* ========================================================
            GROUP A: BRING EVERYTHING TOGETHER
           ======================================================== */}
        {(activeGroup === "all" || activeGroup === "input") && (
          <div className="mt-16 sm:mt-20">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-sky-300 text-xs font-bold font-mono">
                A
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Bring everything together
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Feature 1: Multiple Accounts (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                    <Layers size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Account Management
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Multiple accounts, one view
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Add savings accounts and credit cards. Native parser support for ICICI Bank and HDFC Bank statements.
                  </p>
                </div>

                {/* Visual: Bank Account Cards */}
                <div className="mt-6 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/50 px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b91c1c]/10 text-[#b91c1c] font-bold text-[11px]">
                        ICICI
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Salary Savings A/C</p>
                        <p className="text-[11px] text-muted-foreground font-mono">•••• 4821 · Active</p>
                      </div>
                    </div>
                    <span className="text-right font-mono font-semibold text-foreground">
                      ₹1,42,800
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/50 px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e40af]/10 text-[#1e40af] font-bold text-[11px]">
                        HDFC
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Diners Black Metal</p>
                        <p className="text-[11px] text-muted-foreground font-mono">•••• 9012 · Credit</p>
                      </div>
                    </div>
                    <span className="text-right font-mono font-semibold text-foreground">
                      -₹32,400
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature 2: Statement Imports (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                    <FileSpreadsheet size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Statement Imports
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Drop bank statements. Zero double-counting.
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Import bank statements in PDF, CSV, or Excel formats. Cryptographic transaction hashing ensures imported statements never duplicate repeat items.
                  </p>
                </div>

                {/* Visual: Ingestion Pipeline Demo */}
                <div className="mt-6 rounded-xl border border-border/70 bg-surface/40 p-4">
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2 font-mono text-foreground font-medium">
                      <FileSpreadsheet size={15} className="text-primary dark:text-sky-300" />
                      <span>HDFC_Bank_Statement_Mar2026.pdf</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                      Extracted
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>142 transactions parsed</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">✓ 0 duplicates found</span>
                    <span>Organized: March 2026</span>
                  </div>
                </div>
              </div>

              {/* Feature 3: Smart Categorization (12 cols full-width visual) */}
              <div className="lg:col-span-12 rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xs">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                    <Tags size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Categorization Engine
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Custom rules that learn how you spend
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Combine system categories with your own recurring rules. Set rules by merchant keywords, bank description patterns, or transaction amounts.
                  </p>
                </div>

                {/* Visual: Rule builder mapping */}
                <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-border bg-surface/50 p-3.5">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">If description has</span>
                    <p className="font-mono font-semibold text-foreground mt-1">&quot;SWIGGY&quot; or &quot;ZOMATO&quot;</p>
                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold px-1.5 py-0.5 text-[10px]">
                        Food &amp; Dining
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surface/50 p-3.5">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">If description has</span>
                    <p className="font-mono font-semibold text-foreground mt-1">&quot;LANDLORD NEFT&quot;</p>
                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-muted-foreground">Split Rule:</span>
                      <span className="rounded bg-primary/10 text-primary dark:text-sky-300 font-semibold px-1.5 py-0.5 text-[10px]">
                        50% Self / 50% Partner
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surface/50 p-3.5">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">If description has</span>
                    <p className="font-mono font-semibold text-foreground mt-1">&quot;ZERODHA BROKING&quot;</p>
                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold px-1.5 py-0.5 text-[10px]">
                        Investments &amp; SIP
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            GROUP B: MAKE HOUSEHOLD FINANCES MAKE SENSE
           ======================================================== */}
        {(activeGroup === "all" || activeGroup === "household") && (
          <div className="mt-16 sm:mt-20">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-sky-300 text-xs font-bold font-mono">
                B
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Make household finances make sense
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Feature 4: Household Management (6 cols) */}
              <div className="lg:col-span-6 rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                    <Users size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Household Ownership
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Household members, clear attribution
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Add partners or dependents. Assign financial ownership to every transaction, whether it is 100% individual or shared equally.
                  </p>
                </div>

                {/* Visual: Household Breakdown */}
                <div className="mt-6 rounded-xl border border-border/70 bg-surface/40 p-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50">
                    <span className="font-semibold text-foreground">Household · 2 Members</span>
                    <span className="text-muted-foreground">March 2026 Split</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-medium">Partner A (Self)</span>
                      <span className="font-mono text-foreground font-semibold">₹38,200 (52.8%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-medium">Partner B</span>
                      <span className="font-mono text-foreground font-semibold">₹34,200 (47.2%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden flex border border-border/40 mt-1">
                      <div className="bg-primary h-full w-[52.8%]" />
                      <div className="bg-emerald-600 dark:bg-emerald-500 h-full w-[47.2%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 5: Monthly Reports / Invoices (6 cols) */}
              <div className="lg:col-span-6 rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                    <FileText size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Monthly Invoices &amp; Reports
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Consolidated monthly statement
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Generate structured monthly invoices that combine all credit cards, bills, and splits into one readable statement.
                  </p>
                </div>

                {/* Visual: Invoice Snapshot */}
                <div className="mt-6 rounded-xl border border-border/70 bg-surface/40 p-4 text-xs font-mono">
                  <div className="flex items-center justify-between text-foreground pb-2 border-b border-border/60 font-semibold">
                    <span>REPORT #2026-03</span>
                    <span>₹72,400 TOTAL</span>
                  </div>
                  <div className="mt-2 space-y-1 text-muted-foreground text-[11px]">
                    <div className="flex justify-between">
                      <span>Shared House Rent (50/50)</span>
                      <span className="text-foreground">₹25,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Groceries &amp; Kitchen</span>
                      <span className="text-foreground">₹14,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Electricity &amp; Broadband</span>
                      <span className="text-foreground">₹4,800</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 6: Net Worth Tracking (12 cols) */}
              <div className="lg:col-span-12 rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xs">
                <div className="grid gap-6 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-5">
                    <div className="flex items-center gap-2 text-primary dark:text-sky-300 mb-3">
                      <TrendingUp size={18} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Net Worth
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-foreground">
                      Assets minus liabilities. The real picture.
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      Track EPF, mutual funds, gold, and real estate alongside vehicle and home loans. Measure actual wealth creation, not just monthly cash flow.
                    </p>
                  </div>

                  <div className="md:col-span-7 rounded-xl border border-border/80 bg-surface/50 p-4 sm:p-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-card p-3 border border-border/60">
                        <span className="text-[10px] uppercase font-medium text-muted-foreground">Total Assets</span>
                        <p className="text-base sm:text-lg font-bold text-foreground font-mono mt-0.5">₹26,20,000</p>
                      </div>
                      <div className="rounded-lg bg-card p-3 border border-border/60">
                        <span className="text-[10px] uppercase font-medium text-muted-foreground">Liabilities</span>
                        <p className="text-base sm:text-lg font-bold text-[#b91c1c] dark:text-rose-400 font-mono mt-0.5">-₹7,75,000</p>
                      </div>
                      <div className="rounded-lg bg-primary text-primary-foreground p-3">
                        <span className="text-[10px] uppercase font-medium opacity-80">Net Worth</span>
                        <p className="text-base sm:text-lg font-bold font-mono mt-0.5">₹18,45,000</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            GROUP C: UNDERSTAND YOUR FINANCIAL PROGRESS
           ======================================================== */}
        {(activeGroup === "all" || activeGroup === "growth") && (
          <div className="mt-16 sm:mt-20">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-sky-300 text-xs font-bold font-mono">
                C
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Understand your financial progress
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Feature 7: Spending Insights */}
              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300 mb-4">
                    <PieChart size={18} />
                  </div>
                  <h4 className="text-lg font-bold text-foreground">
                    Spending insights &amp; trends
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Spot category surges before they turn into permanent lifestyle creep. Compare seasonal trends over 3 to 12 months.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/50">
                  <span className="text-xs font-medium text-primary dark:text-sky-300 flex items-center gap-1">
                    <span>Monthly comparison</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>

              {/* Feature 8: Income and Tax Tracker */}
              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300 mb-4">
                    <Landmark size={18} />
                  </div>
                  <h4 className="text-lg font-bold text-foreground">
                    Income &amp; tax tracking
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Track gross earnings, TDS withheld, and advance taxes organized cleanly by Indian Financial Year (FY 2025–26).
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/50">
                  <span className="text-xs font-medium text-primary dark:text-sky-300 flex items-center gap-1">
                    <span>Organized by Financial Year</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>

              {/* Feature 9: Salary Growth */}
              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300 mb-4">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <h4 className="text-lg font-bold text-foreground">
                    Salary history &amp; CTC hikes
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Log historical revisions, appraisal percentage jumps, and visualize how your CTC has compounded over your career.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/50">
                  <span className="text-xs font-medium text-primary dark:text-sky-300 flex items-center gap-1">
                    <span>Appraisal timeline view</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

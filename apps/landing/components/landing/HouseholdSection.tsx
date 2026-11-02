"use client"

import { useState } from "react"
import { Users2, Check } from "lucide-react"

export default function HouseholdSection() {
  const [selectedView, setSelectedView] = useState<"combined" | "partnerA" | "partnerB">("combined")

  const views = {
    combined: {
      label: "Combined Household",
      income: "₹2,10,000",
      spent: "₹1,18,000",
      saved: "₹92,000",
      savingsRate: "43.8%",
      netWorth: "₹38,20,000",
      notes: "Consolidated view of both partners' savings & credit card accounts.",
      breakdown: [
        { label: "Shared House Rent & Maintenance", amount: "₹36,000", split: "50% / 50%" },
        { label: "Family Groceries & Kitchen Supplies", amount: "₹18,500", split: "50% / 50%" },
        { label: "Partner A Discretionary & Gear", amount: "₹22,400", split: "100% Partner A" },
        { label: "Partner B Personal & Wellness", amount: "₹19,200", split: "100% Partner B" },
        { label: "Utilities, Broadband & Subscriptions", amount: "₹7,200", split: "Shared" },
        { label: "Dining Out & Weekend Travel", amount: "₹14,700", split: "Shared" },
      ],
    },
    partnerA: {
      label: "Partner A (Rohan)",
      income: "₹1,20,000",
      spent: "₹62,000",
      saved: "₹58,000",
      savingsRate: "48.3%",
      netWorth: "₹21,80,000",
      notes: "Owns 50% of shared expenses + individual personal spending.",
      breakdown: [
        { label: "50% Share of Rent & Bills", amount: "₹21,600", split: "Obligation" },
        { label: "50% Share of Groceries & Food", amount: "₹16,600", split: "Obligation" },
        { label: "Personal Gear & Technology", amount: "₹18,400", split: "Individual" },
        { label: "Fuel & Vehicle Maintenance", amount: "₹5,400", split: "Individual" },
      ],
    },
    partnerB: {
      label: "Partner B (Priya)",
      income: "₹90,000",
      spent: "₹56,000",
      saved: "₹34,000",
      savingsRate: "37.7%",
      netWorth: "₹16,40,000",
      notes: "Owns 50% of shared expenses + individual personal spending.",
      breakdown: [
        { label: "50% Share of Rent & Bills", amount: "₹21,600", split: "Obligation" },
        { label: "50% Share of Groceries & Food", amount: "₹16,600", split: "Obligation" },
        { label: "Personal Wellness & Classes", amount: "₹12,800", split: "Individual" },
        { label: "Books & Learning", amount: "₹5,000", split: "Individual" },
      ],
    },
  }

  const active = views[selectedView]

  return (
    <section id="households" className="scroll-mt-16 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Story & Principles */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary dark:text-sky-300 mb-4">
              <Users2 size={13} />
              <span>Multi-Member Architecture</span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Money is personal.
              <br />
              <span className="text-primary font-serif italic font-normal dark:text-sky-300">
                Household finances aren&apos;t always.
              </span>
            </h2>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-muted-foreground">
              Most finance apps assume you live alone or force you to manually calculate who owes what in a spreadsheet.
            </p>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
              Wridhy separates individual discretionary freedom from shared household obligations.
              It fosters transparency and clarity without policing what other members spend.
            </p>

            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Check size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  <strong>Granular ownership:</strong> Tag transactions as Self, Partner, or custom split ratios (50/50, 60/40, or exact ₹).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  <strong>Consolidated settlement:</strong> Automatically compute end-of-month balances without awkward WhatsApp math.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  <strong>Dual net worth:</strong> See both individual asset growth and combined household progress.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Household Product Mockup */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xs">
              {/* Interactive View Switcher Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Simulate Household View
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    {active.label}
                  </h3>
                </div>

                <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSelectedView("combined")}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      selectedView === "combined"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedView("partnerA")}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      selectedView === "partnerA"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Partner A
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedView("partnerB")}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      selectedView === "partnerB"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Partner B
                  </button>
                </div>
              </div>

              {/* High Level Key Figures */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Income</span>
                  <p className="text-base font-bold text-foreground font-mono mt-0.5">{active.income}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Expenses</span>
                  <p className="text-base font-bold text-foreground font-mono mt-0.5">{active.spent}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium uppercase">Saved</span>
                  <p className="text-base font-bold text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">{active.saved}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                  <span className="text-[10px] text-primary dark:text-sky-300 font-medium uppercase">Net Worth</span>
                  <p className="text-base font-bold text-foreground font-mono mt-0.5">{active.netWorth}</p>
                </div>
              </div>

              {/* Itemized Household Report Breakdown */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-foreground">Monthly Ledger Breakdown</span>
                  <span className="text-muted-foreground text-[11px]">{active.notes}</span>
                </div>

                <div className="space-y-1.5">
                  {active.breakdown.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-surface/40 px-3 py-2 text-xs border border-border/40 hover:bg-surface/70 transition-colors"
                    >
                      <span className="text-foreground font-medium truncate mr-2">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/60">
                          {item.split}
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {item.amount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

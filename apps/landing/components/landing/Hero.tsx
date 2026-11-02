import { Github, ArrowRight, ShieldCheck, Cpu, HardDrive } from "lucide-react"
import { GITHUB_URL } from "@/lib/utils"

export default function Hero() {
  const spendingCategories = [
    { name: "Home & Utilities", amount: "₹25,000", pct: 34.5, color: "bg-primary" },
    { name: "Food & Dining", amount: "₹12,400", pct: 17.1, color: "bg-emerald-600 dark:bg-emerald-500" },
    { name: "Shopping & Gear", amount: "₹8,800", pct: 12.2, color: "bg-amber-600 dark:bg-amber-500" },
    { name: "Transport", amount: "₹5,200", pct: 7.2, color: "bg-sky-600 dark:bg-sky-500" },
    { name: "Other Expenses", amount: "₹21,000", pct: 29.0, color: "bg-muted-foreground/40" },
  ]

  const sampleTransactions = [
    {
      date: "28 Mar",
      desc: "HDFC Diners · Landlord NEFT",
      cat: "Home",
      owner: "Shared (50/50)",
      amount: "-₹25,000",
    },
    {
      date: "24 Mar",
      desc: "ICICI Savings · Salary Credit",
      cat: "Income",
      owner: "Self",
      amount: "+₹1,20,000",
      isIncome: true,
    },
    {
      date: "19 Mar",
      desc: "Swiggy · Feast Delivery",
      cat: "Food",
      owner: "Self",
      amount: "-₹1,240",
    },
    {
      date: "14 Mar",
      desc: "Fuel & Fastag Auto Top-up",
      cat: "Transport",
      owner: "Partner",
      amount: "-₹2,400",
    },
  ]

  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
      {/* Subtle background ambient warmth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-linear-to-tr from-[#dfd4c0]/30 to-[#182c48]/10 dark:from-primary/10 dark:to-transparent opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          {/* Left Column: Storytelling & Action */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/80 px-3 py-1 text-xs font-medium text-foreground/80 mb-6 backdrop-blur-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>Self-hosted &amp; Statement-based finance</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl/tight">
              Know your money.
              <br />
              <span className="text-primary font-serif italic font-normal dark:text-sky-300">
                Then get on with life.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-xl">
              Your bank statements have the whole story. Wridhy puts it together,
              categorizes your spending, tracks your household finances, and helps
              you see the bigger picture. Without watching every transaction.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/95 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Github size={17} />
                <span>Explore on GitHub</span>
                <ArrowRight size={15} className="opacity-80" />
              </a>

              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:border-foreground/20"
              >
                <span>See how it works</span>
              </a>
            </div>

            {/* Supporting Microcopy */}
            <div className="mt-8 flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">
                <HardDrive size={14} className="text-foreground/70" />
                <span>Runs 100% offline</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-foreground/70" />
                <span>No subscriptions</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Cpu size={14} className="text-foreground/70" />
                <span>Your data stays yours</span>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Monthly Financial Snapshot */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              {/* Backing layered sheet: raw statement ingest preview */}
              <div className="hidden sm:block absolute -top-3 -right-3 bottom-3 -left-3 rounded-2xl border border-border/60 bg-surface/40 -rotate-1 transition-transform -z-10" />

              {/* Main Snapshot Sheet */}
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-xs">
                {/* Snapshot Header */}
                <div className="flex items-start justify-between pb-4 border-b border-border/70">
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                      Monthly Summary
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                      March 2026 Report
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Household · 2 members
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ICICI + HDFC statements
                    </p>
                  </div>
                </div>

                {/* Primary Financial High-Level Metrics */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-left">
                  <div className="rounded-xl border border-border/60 bg-surface/50 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">Income</p>
                    <p className="text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums mt-0.5">
                      ₹1,20,000
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface/50 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">Spent</p>
                    <p className="text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums mt-0.5">
                      ₹72,400
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-3">
                    <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      Savings (39.7%)
                    </p>
                    <p className="text-base sm:text-lg font-bold tracking-tight text-emerald-900 dark:text-emerald-200 tabular-nums mt-0.5">
                      ₹47,600
                    </p>
                  </div>
                </div>

                {/* Combined Household Net Worth Banner */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/20 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary dark:bg-sky-400" />
                    <span className="text-xs font-medium text-foreground">
                      Combined Net Worth
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    ₹18,45,000
                  </span>
                </div>

                {/* Spending Distribution Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="font-medium text-foreground/80">Category Breakdown</span>
                    <span>₹72,400 total</span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface border border-border/40">
                    {spendingCategories.map((cat) => (
                      <div
                        key={cat.name}
                        style={{ width: `${cat.pct}%` }}
                        className={`${cat.color} h-full transition-all`}
                        title={`${cat.name}: ${cat.amount} (${cat.pct}%)`}
                      />
                    ))}
                  </div>

                  {/* Compact Breakdown Tags */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {spendingCategories.slice(0, 4).map((cat) => (
                      <div
                        key={cat.name}
                        className="flex items-center justify-between rounded-lg bg-surface/40 px-2.5 py-1.5 border border-border/40"
                      >
                        <span className="truncate text-muted-foreground mr-1">
                          {cat.name}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums shrink-0">
                          {cat.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Statement Extraction Strip */}
                <div className="mt-5 pt-4 border-t border-border/70">
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="font-semibold text-foreground/90">
                      Extracted &amp; Categorized
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Auto-matched by rules
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {sampleTransactions.slice(0, 3).map((tx, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-surface/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {tx.date}
                          </span>
                          <span className="truncate text-foreground font-medium">
                            {tx.desc}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tx.cat}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              tx.isIncome
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-foreground"
                            }`}
                          >
                            {tx.amount}
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
      </div>
    </section>
  )
}

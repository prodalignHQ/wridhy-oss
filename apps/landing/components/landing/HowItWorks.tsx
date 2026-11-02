import { Upload, Filter, CalendarCheck, Shield } from "lucide-react"

export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      icon: Upload,
      title: "Bring your statements",
      body: "Add your ICICI or HDFC accounts and drop in your bank statements in PDF, Excel, or CSV format. That is the whole setup.",
      note: "No bank passwords or API scrapers",
    },
    {
      step: "02",
      icon: Filter,
      title: "Let Wridhy do the sorting",
      body: "Transactions are parsed, categorized by merchant rules, split across household members, and checked for duplicates automatically.",
      note: "Runs locally on your device",
    },
    {
      step: "03",
      icon: CalendarCheck,
      title: "Take a monthly look",
      body: "Review total household spending, track category pace, observe net worth growth, and plan the upcoming month. Then close the app.",
      note: "Done in 20 focused minutes",
    },
  ]

  return (
    <section id="how" className="scroll-mt-16 border-t border-border/70 bg-surface/30 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary/80 dark:text-sky-300">
            The Workflow
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            From bank statement to financial clarity.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Wridhy doesn&apos;t run background services draining your battery or monitoring transactions 24/7.
            It is a tool that works when you choose to review your finances.
          </p>
        </div>

        {/* 3 Connected Steps */}
        <div className="mt-16 sm:mt-20">
          <div className="relative grid gap-8 md:grid-cols-3">
            {steps.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.step}
                  className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs transition-all hover:border-foreground/20"
                >
                  <div>
                    {/* Step badge & Icon */}
                    <div className="flex items-center justify-between pb-4 border-b border-border/50">
                      <span className="font-mono text-2xl font-extrabold text-primary dark:text-sky-300">
                        {item.step}
                      </span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-foreground border border-border/60">
                        <Icon size={18} />
                      </div>
                    </div>

                    <h3 className="mt-5 text-lg font-bold text-foreground">
                      {item.title}
                    </h3>

                    <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/70 dark:bg-sky-400" />
                    <span>{item.note}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reassurance Callout */}
        <div className="mt-12 mx-auto max-w-2xl text-center rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5 text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Shield size={16} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>
            Statements are processed in memory and written strictly to your local database. Zero telemetry.
          </span>
        </div>
      </div>
    </section>
  )
}

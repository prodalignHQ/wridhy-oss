import { CheckCircle2, HeartHandshake, Eye, Sparkles } from "lucide-react"

export default function Philosophy() {
  const steps = [
    {
      num: "01",
      title: "A month of living",
      subtitle: "Day 1 to Day 30",
      description:
        "Buy the coffee. Settle the rent. Pay for dinner with friends. Live your life without push alerts, SMS scraping, or an app making you feel guilty about every tap.",
      tag: "Zero anxiety",
    },
    {
      num: "02",
      title: "A monthly financial review",
      subtitle: "Day 31 · ~20 minutes",
      description:
        "Download your ICICI or HDFC statements. Drop them into Wridhy. Transactions are organized, categorized, and split with household members in one focused sitting.",
      tag: "Focused intent",
    },
    {
      num: "03",
      title: "A clearer financial picture",
      subtitle: "Next month and beyond",
      description:
        "See where your household stands, how your net worth grew, and whether your salary trajectory aligns with your life goals. Then close the tab.",
      tag: "True peace of mind",
    },
  ]

  const tenets = [
    {
      icon: Eye,
      title: "Every transaction doesn't need your attention.",
      body: "Knowing you spent ₹320 on lunch five minutes ago changes nothing. Knowing your monthly dining total was 18% of your income gives you actionable clarity.",
    },
    {
      icon: HeartHandshake,
      title: "Every month deserves a review.",
      body: "A dedicated monthly check-in turns finances from a chaotic daily chore into a deliberate, calm ritual for you and your household.",
    },
    {
      icon: Sparkles,
      title: "Progress matters more than perfection.",
      body: "A little overspending in one category isn't a crisis. Financial awareness should build long-term confidence, not short-term dread.",
    },
  ]

  return (
    <section
      id="philosophy"
      className="relative scroll-mt-16 border-y border-border/70 bg-surface/30 py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Editorial Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary/80 dark:text-sky-300">
            The Philosophy
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Your money doesn&apos;t need a live commentary.
          </h2>
          <div className="mt-6 space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
            <p>
              You don&apos;t need an alert every time you buy coffee. You don&apos;t need
              to open an app five times a day to check whether you&apos;re doing okay.
            </p>
            <p className="font-medium text-foreground">
              Give your finances an hour every month. Understand what happened, make a plan,
              and move on.
            </p>
            <p>
              Because financial awareness should give you peace of mind, not another
              thing to worry about.
            </p>
          </div>
        </div>

        {/* Horizontal Visual Progression (Stacks cleanly on mobile) */}
        <div className="mt-16 sm:mt-20">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.num}
                className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xs transition-all hover:-translate-y-1 hover:border-foreground/20"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50">
                    <span className="font-mono text-2xl font-bold tracking-tight text-primary dark:text-sky-300">
                      {step.num}
                    </span>
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {step.tag}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {step.subtitle}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/40 flex items-center gap-1.5 text-xs text-primary dark:text-sky-300 font-semibold">
                  <CheckCircle2 size={14} />
                  <span>
                    {idx === 0
                      ? "No intrusive alerts"
                      : idx === 1
                      ? "One-click statement import"
                      : "Actionable understanding"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Three Core Tenets Callout */}
        <div className="mt-14 sm:mt-18 rounded-2xl border border-border/80 bg-card/60 p-6 sm:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            {tenets.map((tenet) => {
              const Icon = tenet.icon
              return (
                <div key={tenet.title} className="flex flex-col">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/25 dark:text-sky-300 mb-3.5">
                    <Icon size={18} />
                  </div>
                  <h4 className="text-base font-bold text-foreground leading-snug">
                    {tenet.title}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {tenet.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

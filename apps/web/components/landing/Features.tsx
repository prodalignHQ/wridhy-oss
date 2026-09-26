import { cn } from "@/lib/utils"

const features = [
  {
    emoji: "📊",
    title: "Command center",
    tag: "See it all",
    body: "Income, spend & savings at a glance. Spot overspend before it happens.",
    points: ["Cash flow live", "Spending velocity", "Pretty charts"],
    span: true,
  },
  {
    emoji: "💳",
    title: "All accounts, one ledger",
    tag: "Bye chaos",
    body: "Checking, credit, investments — one searchable register.",
    points: ["Instant search", "Category badges"],
  },
  {
    emoji: "📄",
    title: "Drag, drop, done",
    tag: "30 seconds",
    body: "CSV, Excel, PDF. HDFC, ICICI & more. Zero dupes, ever.",
    points: ["SHA-256 dedupe"],
  },
  {
    emoji: "⚡",
    title: "Auto-magic labels",
    tag: "No chores",
    body: "`POS SWIGGY BLR` → `Swiggy`. Rules do the boring work.",
    points: ["Custom rules", "Priority order"],
  },
  {
    emoji: "👥",
    title: "Split with humans",
    tag: "Couples ♥",
    body: "Tag Self, Partner, Kids. Split by % or ₹. No awkward math.",
    points: ["Who spent what"],
  },
  {
    emoji: "🧾",
    title: "Monthly invoices",
    tag: "Settle up",
    body: "Pool cards + bills into one invoice. Share & settle in a tap.",
    points: ["Per-person share"],
  },
  {
    emoji: "📈",
    title: "Net worth glow-up",
    tag: "Big picture",
    body: "Stocks, gold, home, EPF + loans. Watch the line go up.",
    points: ["Monthly snapshots"],
  },
  {
    emoji: "💡",
    title: "Insights that roast you",
    tag: "Gently",
    body: "Find leaky subscriptions & dining spirals before they compound.",
    points: ["Kill the leaks"],
  },
  {
    emoji: "🔒",
    title: "Private. For real.",
    tag: "Offline-first",
    body: "SQLite on your laptop, or self-host. No aggregators. Ever.",
    points: ["MIT open source"],
    span: true,
  },
]

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 md:py-20">
      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary">
        ✨ Everything inside
      </p>
      <h2 className="mx-auto mt-2 max-w-xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
        9 superpowers. Zero headaches.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] text-muted-foreground">
        Short version: import → auto-clean → split → grow. Long version 👇
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <article
            key={f.title}
            className={cn(
              "group rounded-2xl border-2 border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#1b365d] dark:hover:shadow-[6px_6px_0_0_#52525b]",
              f.span && "sm:col-span-2 lg:col-span-1",
              f.title === "Command center" && "border-primary bg-primary text-white",
              f.title === "Private. For real." &&
                "border-[#18181b] bg-[#18181b] text-white dark:border-zinc-700"
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{f.emoji}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  f.title === "Command center" || f.title === "Private. For real."
                    ? "bg-white/15 text-white"
                    : "bg-muted text-foreground/70"
                }`}
              >
                {f.tag}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold leading-snug">{f.title}</h3>
            <p
              className={`mt-1.5 text-sm leading-relaxed ${
                f.title === "Command center" || f.title === "Private. For real."
                  ? "text-white/80"
                  : "text-muted-foreground"
              }`}
            >
              {f.body}
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {f.points.map((p) => (
                <li
                  key={p}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    f.title === "Command center" || f.title === "Private. For real."
                      ? "bg-white/15"
                      : "bg-muted"
                  }`}
                >
                  ✓ {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

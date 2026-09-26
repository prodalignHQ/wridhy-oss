import Link from "next/link"
import { cn } from "@/lib/utils"

interface Feature {
  emoji: string
  title: string
  tag: string
  body: string
  points: string[]
  span?: boolean
  href?: string
}

const features: Feature[] = [
  {
    emoji: "📊",
    title: "Command center",
    tag: "See it all",
    body: "Income, spend & savings at a glance. Spot overspend before it happens.",
    points: ["Money in & out", "Spending pace", "Simple charts"],
    span: true,
  },
  {
    emoji: "💳",
    title: "All accounts in one place",
    tag: "Bye chaos",
    body: "Savings, credit cards, investments — all in one simple list.",
    points: ["Quick search", "Auto categories"],
  },
  {
    emoji: "📄",
    title: "Drag, drop, done",
    tag: "30 seconds",
    body: "Bank statements in Excel, CSV, or PDF. HDFC, ICICI & more. No double-counting, ever.",
    points: ["Skips repeats automatically"],
  },
  {
    emoji: "⚡",
    title: "Auto-magic labels",
    tag: "No chores",
    body: "Messy bank names get cleaned up automatically. Set your rules once and relax.",
    points: ["Your own rules", "Automatic sorting"],
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
    points: ["Monthly progress"],
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
    title: "100% private. For real.",
    tag: "Zero-knowledge soon",
    body: "Parsed on your device, sealed with a key only you hold. Passkey unlock. Our servers see ciphertext — or nothing at all.",
    points: ["On-device everything", "Encrypted vault"],
    span: true,
    href: "/privacy",
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
              f.title === "100% private. For real." &&
                "border-[#18181b] bg-[#18181b] text-white dark:border-zinc-700"
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{f.emoji}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  f.title === "Command center" || f.title === "100% private. For real."
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
                f.title === "Command center" || f.title === "100% private. For real."
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
                    f.title === "Command center" || f.title === "100% private. For real."
                      ? "bg-white/15"
                      : "bg-muted"
                  }`}
                >
                  ✓ {p}
                </li>
              ))}
            </ul>
            {f.href && (
              <Link
                href={f.href}
                className={`mt-3 inline-block text-sm font-bold underline-offset-4 hover:underline ${
                  f.title === "100% private. For real." ? "text-white" : "text-primary"
                }`}
              >
                How we do it →
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

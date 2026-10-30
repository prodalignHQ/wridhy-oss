import { Github } from "lucide-react"
import { GITHUB_URL } from "@/lib/utils"

const steps = [
  { emoji: "📥", title: "Drop statements", body: "Drag your CSV / Excel / PDF. That's the whole setup." },
  { emoji: "🪄", title: "Watch it tidy up", body: "Merchants cleaned. Categories + owners auto-assigned." },
  { emoji: "🤝", title: "Split & settle", body: "Invoice the month. Settle with family. Track net worth." },
]

export default function HowItWorks() {
  return (
    <section id="how" className="border-y-2 border-border bg-muted/60 scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-18">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          How it works 🛝
        </h2>
        <p className="mt-2 text-center text-[15px] text-muted-foreground">
          If you can attach a file to an email, you can use Wridhy.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border-2 border-border bg-card p-6 text-center"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white">
                Step {i + 1}
              </span>
              <p className="mt-2 text-4xl">{s.emoji}</p>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        {/* privacy + deploy */}
        <div id="privacy" className="mt-10 grid scroll-mt-24 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-primary p-6 text-white sm:p-8">
            <p className="text-3xl">🔒</p>
            <h3 className="mt-2 text-xl font-bold">Your data never leaves you.</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Everything stays on your device. No bank logins, no ads, no selling data. Delete anytime.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/15 px-3 py-1.5">✓ 100% offline</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">✓ No cloud needed</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">✓ You own your data</span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-6 sm:p-8">
            <p className="text-3xl">☁️</p>
            <h3 className="mt-2 text-xl font-bold">Use it on all your devices.</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Phone + laptop stay in sync. Your money, always with you, safely.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white"
              >
                <Github size={16} />
                <span>View on GitHub →</span>
              </a>
              <a
                href="#features"
                className="rounded-xl border-2 border-border px-5 py-2 text-center text-sm font-semibold hover:bg-muted"
              >
                👀 See features
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

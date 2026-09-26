import Link from "next/link"

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* playful blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-[#10b981]/15 blur-3xl" />
        <div className="absolute top-10 -right-20 h-72 w-72 rounded-full bg-[#f59e0b]/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[#0ea5e9]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:pt-20">
        <div>
          <div className="mb-4 inline-flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              🔒 Private by default
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              💸 No subscriptions
            </span>
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Your money,
            <br />
            <span className="text-primary">your rules.</span> 💰
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Drop in bank statements. MoMoney cleans, splits & explains them.
            Works offline. No snooping.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-xl bg-primary px-6 py-3.5 text-center text-[15px] font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Start tracking — it&apos;s free →
            </Link>
            <a
              href="#features"
              className="rounded-xl border-2 border-border bg-card px-6 py-3 text-center text-[15px] font-semibold transition-colors hover:bg-muted"
            >
              👀 See the magic
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-muted-foreground">
            <span>⚡ 30-sec setup</span>
            <span>📄 CSV · Excel · PDF</span>
            <span>💻 Works offline</span>
          </div>
        </div>

        {/* fun mock dashboard card */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -top-4 -right-2 rotate-6 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-lg">
            + ₹12,400 saved 🎉
          </div>
          <div className="absolute -bottom-4 -left-2 -rotate-3 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold shadow-lg">
            Swiggy → Food 🍔
          </div>

          <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-[8px_8px_0_0_#1b365d] dark:shadow-[8px_8px_0_0_#52525b]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                March cash flow
              </p>
              <span className="rounded-full bg-[#10b981]/15 px-2.5 py-1 text-xs font-bold text-[#0d7a56] dark:text-emerald-300">
                ● Live
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-[11px] font-medium text-muted-foreground">In</p>
                <p className="text-sm font-bold">₹85K</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Out</p>
                <p className="text-sm font-bold">₹52K</p>
              </div>
              <div className="rounded-xl bg-primary p-3 text-white">
                <p className="text-[11px] opacity-80">Kept</p>
                <p className="text-sm font-bold">₹33K ✨</p>
              </div>
            </div>

            {/* fake bars */}
            <div className="mt-4 flex h-24 items-end gap-2">
              {[40, 65, 50, 80, 55, 90, 70, 100, 62, 78, 48, 85].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-t-md ${
                    i === 7 ? "bg-[#10b981]" : i === 9 ? "bg-[#f59e0b]" : "bg-primary/85"
                  }`}
                />
              ))}
            </div>

            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>🍔 Swiggy · <b>Self</b></span>
                <span className="font-bold">-₹499</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>🏠 Rent split · <b>50/50</b></span>
                <span className="font-bold">-₹15K</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ticker strip */}
      <div className="border-y-2 border-border bg-primary py-2.5 text-white">
        <p className="mx-auto max-w-6xl overflow-hidden whitespace-nowrap px-4 text-center text-[13px] font-semibold tracking-wide sm:text-sm">
          NO TRACKERS ✦ NO BANK LOGINS ✦ NO SUBSCRIPTIONS ✦ YOUR DATA STAYS YOURS ✦ MADE FOR FAMILIES ✦
        </p>
      </div>
    </section>
  )
}

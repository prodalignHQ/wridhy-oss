import Link from "next/link"
import { isLocalMode } from "@/lib/local-mode"

export default function Footer() {
  // Standalone binary has no accounts — "Log in" goes straight to the app.
  const loginHref = isLocalMode() ? "/dashboard" : "/login"
  return (
    <footer className="bg-[#18181b] text-white dark:border-t dark:border-border dark:bg-black">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl bg-primary p-8 text-center sm:p-10">
          <p className="text-4xl">💸➡️😎</p>
          <h2 className="mx-auto mt-3 max-w-md text-2xl font-bold leading-tight sm:text-3xl">
            Stop guessing where your money went.
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/80">
            Free. Private. Fun-ish (for finance). Takes 30 seconds.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-7 py-3 text-[15px] font-bold text-primary transition-transform hover:-translate-y-0.5"
            >
              Open MoMoney →
            </Link>
            <Link
              href={loginHref}
              className="rounded-xl border-2 border-white/30 px-7 py-3 text-[15px] font-bold text-white hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 text-sm text-white/60 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary">
              ₹
            </span>
            <span className="font-semibold text-white">MoMoney</span>
            <span>· 100% private by design</span>
          </div>
          <div className="flex gap-5">
            <a href="/#features" className="hover:text-white">Features</a>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

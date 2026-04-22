import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">₹</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">MoMoney</span>
        </div>

        <h1 className="text-4xl font-semibold text-foreground">
          Your money,{" "}
          <span className="text-indigo-400">your rules.</span>
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Privacy-first personal finance. Import bank statements, auto-categorize
          transactions, and understand your spending — without giving up your data.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors duration-150"
          >
            Open Dashboard
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-secondary hover:bg-muted text-foreground font-medium transition-colors duration-150"
          >
            Sign In to Sync
          </Link>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">No account required to get started.</p>
          <p className="text-xs text-muted-foreground/60">
            By default, everything runs locally in your browser.
          </p>
        </div>
      </div>
    </div>
  )
}

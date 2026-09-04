import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-lg">₹</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">MoMoney</span>
        </div>

        <h1 className="text-4xl font-semibold text-foreground">
          Your money,{" "}
          <span className="text-primary">your rules.</span>
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Privacy-first personal finance. Import bank statements, auto-categorize
          transactions, and understand your spending — without giving up your data.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg bg-primary hover:bg-primary text-white font-medium transition-colors duration-150"
          >
            Open Dashboard
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/70 pt-4">
          Running in session mode — your data never leaves this browser.
        </p>
      </div>
    </div>
  )
}

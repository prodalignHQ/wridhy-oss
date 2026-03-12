import { TrendingUp } from "lucide-react"

export default function NetWorthPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Net Worth</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <TrendingUp size={40} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Track your net worth</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Add assets and liabilities, save monthly snapshots, and watch your net worth grow over time. Coming in Phase 5.
        </p>
      </div>
    </div>
  )
}

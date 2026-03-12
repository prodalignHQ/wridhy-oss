import { BarChart3 } from "lucide-react"

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Insights</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 size={40} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Insights coming soon</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Year-over-year charts, category trends, and merchant analytics will appear here once you&apos;ve imported transactions.
        </p>
      </div>
    </div>
  )
}

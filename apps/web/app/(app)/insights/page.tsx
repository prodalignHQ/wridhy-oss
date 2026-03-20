import { BarChart3 } from "lucide-react"

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 size={40} className="text-muted-foreground/70 mb-4" />
        <h2 className="text-lg font-semibold text-foreground/80 mb-2">Insights coming soon</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Year-over-year charts, category trends, and merchant analytics will appear here once you&apos;ve imported transactions.
        </p>
      </div>
    </div>
  )
}

import { Sliders } from "lucide-react"

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Rules</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Sliders size={40} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Automate categorization</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Create rules like &quot;description contains NETFLIX → Subscriptions&quot; to auto-categorize transactions on import. Coming in Phase 3.
        </p>
      </div>
    </div>
  )
}

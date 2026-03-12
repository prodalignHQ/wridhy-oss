import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Settings size={40} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Settings coming soon</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Manage household members, storage mode (cloud vs local SQLite), data export, and account settings. Coming in Phase 6.
        </p>
      </div>
    </div>
  )
}

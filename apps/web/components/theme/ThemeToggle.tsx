"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme/ThemeProvider"

export function ThemeToggle() {
  const { mounted, theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Appearance</p>
        <p className="text-xs text-muted-foreground">
          {mounted ? (isDark ? "Dark mode" : "Light mode") : "Syncing theme"}
        </p>
      </div>
      <button
        type="button"
        aria-label="Toggle color mode"
        onClick={toggleTheme}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {mounted ? (isDark ? "Dark" : "Light") : "Theme"}
      </button>
    </div>
  )
}

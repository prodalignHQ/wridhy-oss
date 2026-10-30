"use client"

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  mounted: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = "wridhy-theme"

const ThemeContext = createContext<ThemeContextValue | null>(null)

const emptySubscribe = () => () => {}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark"
  const root = document.documentElement

  root.classList.toggle("dark", isDark)
  root.dataset.theme = theme
  root.style.colorScheme = theme

  if (document.body) {
    document.body.classList.toggle("dark", isDark)
    document.body.dataset.theme = theme
    document.body.style.colorScheme = theme
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark"
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : getSystemTheme()
  })

  useEffect(() => {
    applyTheme(theme)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mounted,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mounted, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}

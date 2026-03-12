"use client"

import React, { createContext, useContext, useState } from "react"

type StorageMode = "session" | "local-sqlite" | "cloud"

// Minimal DataAdapter interface — a stub until Phase 2+
interface DataAdapter {
  getTransactions: () => Promise<unknown[]>
  saveTransactions: (data: unknown[]) => Promise<void>
}

const sessionAdapter: DataAdapter = {
  getTransactions: async () => [],
  saveTransactions: async () => {},
}

interface StorageModeContextValue {
  mode: StorageMode
  setMode: (mode: StorageMode) => void
  adapter: DataAdapter
}

const StorageModeContext = createContext<StorageModeContextValue>({
  mode: "session",
  setMode: () => {},
  adapter: sessionAdapter,
})

export function StorageModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<StorageMode>("session")

  const setMode = (newMode: StorageMode) => {
    setModeState(newMode)
    if (typeof window !== "undefined") {
      localStorage.setItem("momoney_storage_mode", newMode)
    }
  }

  return (
    <StorageModeContext.Provider value={{ mode, setMode, adapter: sessionAdapter }}>
      {children}
    </StorageModeContext.Provider>
  )
}

export const useStorageMode = () => useContext(StorageModeContext)

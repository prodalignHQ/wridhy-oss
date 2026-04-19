"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import {
  MonthlyInsight,
  YearlyInsight,
  CategoryComparison,
  CategoryAverage,
} from "@momoney/types"
import { apiClient } from "../api"
import { useAuthStore } from "./auth.store"

type StorageMode = "session" | "local-sqlite" | "cloud"

export interface DataAdapter {
  getTransactions: (filters?: any) => Promise<any>
  saveTransactions: (data: any[]) => Promise<void>
  getMonthlyInsights: (month: string, ownerIds?: string[]) => Promise<MonthlyInsight>
  getYearlyInsights: (year: number, ownerIds?: string[]) => Promise<YearlyInsight>
  getCategoryTrends: (year: number, ownerIds?: string[]) => Promise<any[]>
  getCategoryComparison: (month: string, ownerIds?: string[]) => Promise<CategoryComparison>
  getCategoryAverages: (month: string, ownerIds?: string[]) => Promise<CategoryAverage>
}

// Session Adapter implementation (stub for now, will compute from local store in future if needed)
const sessionAdapter: DataAdapter = {
  getTransactions: async () => [],
  saveTransactions: async () => {},
  getMonthlyInsights: async () => ({
    totalSpend: "0",
    totalIncome: "0",
    netFlow: "0",
    topCategories: [],
    topMerchants: [],
    uncategorizedCount: 0,
  }),
  getYearlyInsights: async () => [],
  getCategoryTrends: async () => [],
  getCategoryComparison: async () => [],
  getCategoryAverages: async () => [],
}

// Cloud Adapter implementation
const cloudAdapter: DataAdapter = {
  getTransactions: async (filters) => {
    const params = new URLSearchParams(filters)
    return apiClient.fetch(`/v1/transactions?${params.toString()}`)
  },
  saveTransactions: async () => {}, // Handled by separate endpoints mostly
  getMonthlyInsights: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/monthly?${params.toString()}`)
  },
  getYearlyInsights: async (year, ownerIds) => {
    const params = new URLSearchParams({ year: String(year) })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/yearly?${params.toString()}`)
  },
  getCategoryTrends: async (year, ownerIds) => {
    const params = new URLSearchParams({ year: String(year) })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-trends?${params.toString()}`)
  },
  getCategoryComparison: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-comparison?${params.toString()}`)
  },
  getCategoryAverages: async (month, ownerIds) => {
    const params = new URLSearchParams({ month })
    if (ownerIds?.length) params.set("ownerIds", ownerIds.join(","))
    return apiClient.fetch(`/v1/insights/category-averages?${params.toString()}`)
  },
}

interface StorageModeContextValue {
  mode: StorageMode
  setMode: (mode: StorageMode) => void
  adapter: DataAdapter
}

const StorageModeContext = React.createContext<StorageModeContextValue>({
  mode: "session",
  setMode: () => {},
  adapter: sessionAdapter,
})

export function StorageModeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const [mode, setModeState] = useState<StorageMode>("session")

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("momoney_storage_mode") as StorageMode
      
      if (user) {
        // If logged in, we generally want cloud mode unless they've explicitly switched to something else
        // during THIS session. But to stay safe, we default to cloud if no persistent preference or session
        if (!saved || saved === "session") {
          setModeState("cloud")
        } else {
          setModeState(saved)
        }
      } else if (saved) {
        setModeState(saved)
      }
    }
  }, [user])

  const setMode = (newMode: StorageMode) => {
    setModeState(newMode)
    if (typeof window !== "undefined") {
      localStorage.setItem("momoney_storage_mode", newMode)
    }
  }

  const adapter = mode === "cloud" ? cloudAdapter : sessionAdapter

  return (
    <StorageModeContext.Provider value={{ mode, setMode, adapter }}>
      {children}
    </StorageModeContext.Provider>
  )
}

export const useStorageMode = () => useContext(StorageModeContext)

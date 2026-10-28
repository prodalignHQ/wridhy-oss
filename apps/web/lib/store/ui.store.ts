import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  isPrivacyMode: boolean
  togglePrivacyMode: () => void
  setPrivacyMode: (enabled: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      isPrivacyMode: false,
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
      setPrivacyMode: (enabled) => set({ isPrivacyMode: enabled }),
    }),
    {
      name: 'momoney-ui-storage',
    }
  )
)

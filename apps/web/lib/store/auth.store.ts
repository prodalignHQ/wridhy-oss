import { create } from 'zustand'
import { authClient } from '../auth.client'

interface AuthState {
  user: any | null
  setUser: (user: any | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    // Lock the vault FIRST (flush + seal + wipe DEK) while the session — and
    // the in-memory DEK — still exists. Otherwise logout would leave the
    // OPFS database unsealed on disk for the next browser-profile reader.
    try {
      const { useVaultStore } = await import('./vault.store')
      await useVaultStore.getState().lock()
    } catch {
      // proceed with logout regardless
    }
    await authClient.signOut()
    set({ user: null })
    window.location.href = '/login'
  },
}))

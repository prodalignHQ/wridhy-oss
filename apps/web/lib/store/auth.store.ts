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
    await authClient.signOut()
    set({ user: null })
    window.location.href = '/login'
  },
}))

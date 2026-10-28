'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useUIStore } from '@/lib/store/ui.store'

export function PrivacyModeSync() {
  const isPrivacyMode = useUIStore((state) => state.isPrivacyMode)
  const togglePrivacyMode = useUIStore((state) => state.togglePrivacyMode)

  // Sync to documentElement
  useEffect(() => {
    if (isPrivacyMode) {
      document.documentElement.setAttribute('data-privacy-mode', 'true')
      document.documentElement.classList.add('privacy-mode')
    } else {
      document.documentElement.removeAttribute('data-privacy-mode')
      document.documentElement.classList.remove('privacy-mode')
    }
  }, [isPrivacyMode])

  // Keyboard shortcut: Alt+P or Cmd+Shift+P / Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input/textarea
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if (
        (e.altKey && e.key.toLowerCase() === 'p') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p')
      ) {
        if (!isInput) {
          e.preventDefault()
          const next = !isPrivacyMode
          togglePrivacyMode()
          if (next) {
            toast.success('Privacy mode active — numbers masked for screenshots', {
              id: 'privacy-toast',
              duration: 2500,
            })
          } else {
            toast.info('Privacy mode disabled — numbers unmasked', {
              id: 'privacy-toast',
              duration: 2500,
            })
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPrivacyMode, togglePrivacyMode])

  return null
}

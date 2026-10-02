'use client'

// ─── Vault onboarding route ──────────────────────────────────────────────────
// Thin host. The setup flow itself lives in `components/tour` so it can be
// re-mounted from Settings, the sidebar and the dashboard without duplicating
// a page. Route and path are unchanged from the previous wizard, so existing
// links (dashboard banner, deep links, docs) still land in the right place.

import { VaultTour } from '@/components/tour/VaultTour'

export default function VaultOnboardingPage() {
  return <VaultTour />
}

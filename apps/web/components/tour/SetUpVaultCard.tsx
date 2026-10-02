'use client'

// ─── Settings → "Set up your vault" ──────────────────────────────────────────
// Only rendered when there is genuinely no vault. Once one exists this card is
// gone: the right place to manage an existing vault is the Encrypted Vault
// section next to it, and offering to "set up" something that is already set
// up is just noise.

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { TOUR_PATH } from '@/lib/store/tour.store'
import { useHasVault } from '@/lib/use-has-vault'

export function SetUpVaultCard() {
  const hasVault = useHasVault()
  // null = still checking, or we could not tell. Show nothing either way.
  if (hasVault !== false) return null

  return (
    <Link href={TOUR_PATH} className="h-full">
      <Card className="flex h-full flex-col border-border border-primary/40 bg-primary/5 p-6 transition-colors hover:border-primary/70">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            <Lock size={20} />
          </div>
          <h2 className="font-semibold text-foreground">Set up your vault</h2>
        </div>
        <p className="mb-4 flex-1 text-sm text-muted-foreground">
          Lock your money data with a password, a fingerprint, and a recovery key. About a minute.
        </p>
        <div className="mt-auto">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Required
          </span>
        </div>
      </Card>
    </Link>
  )
}

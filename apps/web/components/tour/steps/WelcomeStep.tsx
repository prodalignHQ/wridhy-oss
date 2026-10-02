'use client'

// ─── Step 1 — Welcome ────────────────────────────────────────────────────────
// This is vault setup, not a product tour, so it says exactly that. The only
// job here is to answer the two questions a first-time user actually has:
// what is this, and what are you about to do. The one bit of real persuasion
// — "the server sees nothing" — is shown as data next to gibberish rather
// than asserted as a claim.

import { useState } from 'react'
import { KeyRound, Fingerprint, LifeBuoy, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ServerSeesNothing, TourShield } from '@/components/tour/TourBits'

const STEPS = [
  { icon: KeyRound, label: 'Password' },
  { icon: Fingerprint, label: 'Passkey' },
  { icon: LifeBuoy, label: 'Recovery key' },
]

export function WelcomeStep({
  onContinue,
  onSkip,
  onRestored,
  busy,
}: {
  onContinue: () => void
  onSkip: () => void
  /** A backup file was restored — go unlock it with its original credentials. */
  onRestored: () => void
  busy: boolean
}) {
  const [restoring, setRestoring] = useState(false)

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center px-6 py-7 text-center">
        <TourShield />

        <h2 className="mt-4 text-xl font-semibold text-foreground">Lock your money data</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your vault holds it in a locked safe. Three things open it — and only you can.
        </p>

        {/* Three words, not three essays. */}
        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-3 bg-border" aria-hidden />}
              <span
                className="animate-in fade-in-0 zoom-in-90 flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground motion-reduce:animate-none"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <step.icon size={13} className="text-primary" />
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 w-full">
          <ServerSeesNothing />
        </div>

        <Button onClick={onContinue} disabled={busy} className="mt-6 h-10 w-full text-sm">
          Set up my vault
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={busy} className="mt-1 w-full text-muted-foreground">
          Not now
        </Button>

        {/* Escape hatch for people arriving from another install. */}
        <div className="mt-4 border-t border-border pt-3.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {restoring ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {restoring ? 'Restoring…' : 'Already have a backup file?'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setRestoring(true)
                try {
                  const { restoreVaultFromFile } = await import('@/lib/engine/vault-sync')
                  await restoreVaultFromFile(file)
                  toast.success('Backup restored — unlock with your original password or recovery key')
                  onRestored()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Restore failed')
                } finally {
                  setRestoring(false)
                }
              }}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, KeyRound, ShieldCheck, ArrowRight, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVaultStore } from '@/lib/store/vault.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { isWebAuthnAvailable } from '@/lib/engine/webauthn-prf'
import { normalizeRecoveryCode, createVaultParams, deriveKek } from '@momoney/local-engine'

type Step = 'intro' | 'method' | 'recovery' | 'done'

export const VAULT_ONBOARDING_SKIP_KEY = 'momoney_vault_onboarding_skip'

export default function VaultOnboardingPage() {
  const router = useRouter()
  const vault = useVaultStore()
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState<Step>('intro')
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)
  // Passkey-first flow state: taps done (credential + PRF proven), awaiting
  // the mandatory vault password before creation.
  const [pendingPk, setPendingPk] = useState<{
    credentialId: string
    label: string
    prfOutput: Uint8Array
    saltB64: string
    iterations: number
    memorySize: number
  } | null>(null)

  // Already has a vault → nothing to do here.
  useEffect(() => {
    let cancelled = false
    import('@/lib/engine/vault-sync').then(async ({ fetchVaultBlob }) => {
      const blob = await fetchVaultBlob().catch(() => null)
      if (cancelled) return
      if (blob) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const skip = () => {
    try {
      sessionStorage.setItem(VAULT_ONBOARDING_SKIP_KEY, '1')
    } catch {
      // ignore
    }
    router.replace('/dashboard')
  }

  const currentSnapshot = async () => {
    const [{ readLocalCache }, { buildVaultSnapshot }] = await Promise.all([
      import('@/lib/engine/opfs-db'),
      import('@/lib/engine/vault-sync'),
    ])
    const cache = await readLocalCache().catch(() => null)
    return buildVaultSnapshot(
      cache ?? {
        transactions: [], categories: [], statements: [], accounts: [], owners: [],
        transactionOwners: [], rules: [], merchants: [], invoices: [],
        invoiceStatements: [], invoiceItems: [],
      }
    )
  }

  const handlePasswordSetup = async () => {
    if (password.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await vault.setup(password, await currentSnapshot())
      setPassword('')
      setConfirm('')
      setStep('recovery')
    } catch {
      toast.error(vault.error ?? 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePasskeySetup = async () => {
    setBusy(true)
    setWarn(null)
    try {
      const { registerPrfCredential, evalPrf, derivePrfInput } = await import('@/lib/engine/webauthn-prf')
      const params = createVaultParams()
      const label = deviceLabel.trim() || 'This device'
      // Two authenticator taps: register, then prove PRF evaluability.
      // Creation happens after the mandatory password step below.
      const { credentialIdB64url } = await registerPrfCredential(user?.email ?? 'momoney-user')
      const prfOutput = await evalPrf(credentialIdB64url, await derivePrfInput(params.saltB64))
      setPendingPk({
        credentialId: credentialIdB64url,
        label,
        prfOutput,
        saltB64: params.saltB64,
        iterations: params.iterations,
        memorySize: params.memorySize,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Passkey setup failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePasskeyFinalize = async () => {
    if (!pendingPk) return
    if (password.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setBusy(true)
    setWarn(null)
    try {
      const { setupVaultWithPasskeys } = await import('@/lib/engine/vault-sync')
      // The password is the portable factor: this exact KEK is what a new
      // device will derive to join. The passkey stays the daily driver here.
      const passwordKek = await deriveKek(password, {
        saltB64: pendingPk.saltB64,
        iterations: pendingPk.iterations,
        memorySize: pendingPk.memorySize,
      })
      const { blob, recoveryCode, dek, wrapError } = await setupVaultWithPasskeys(
        [{ credentialId: pendingPk.credentialId, label: pendingPk.label, prfOutput: pendingPk.prfOutput }],
        await currentSnapshot(),
        { saltB64: pendingPk.saltB64, iterations: pendingPk.iterations, memorySize: pendingPk.memorySize },
        passwordKek
      )
      passwordKek.fill(0)
      pendingPk.prfOutput.fill(0)
      setPendingPk(null)
      setPassword('')
      setConfirm('')
      vault.adoptSession(blob, dek, await currentSnapshot(), recoveryCode)
      if (wrapError) setWarn(`Vault created, but the passkey wrap needs attention: ${wrapError}. Password and recovery code work regardless.`)
      setStep('recovery')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Passkey setup failed')
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-sm text-muted-foreground">
        Checking vault status…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step toward 100% private</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Secure your vault</h1>
      </div>

      {step === 'intro' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} /> Two keys, two jobs</CardTitle>
            <CardDescription>
              Your <b>login</b> proves who you are to the server. Your <b>vault key</b> scrambles your money data so
              that even we can&apos;t read it. They are different on purpose — and the vault key never leaves this
              device.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button onClick={() => setStep('method')} className="w-full">
              Continue — 60 seconds <ArrowRight size={14} className="ml-2" />
            </Button>
            <Button variant="ghost" onClick={skip} className="w-full text-muted-foreground">
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'method' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Choose your unlock</CardTitle>
            <CardDescription>A recovery code is issued either way — write it down when shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isWebAuthnAvailable() ? (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold flex items-center gap-2"><Fingerprint size={15} /> Passkey (recommended)</p>
                <p className="text-xs text-muted-foreground">Face ID / fingerprint / PIN. Nothing to remember, nothing to phish.</p>
                {!pendingPk ? (
                  <>
                    <Input
                      placeholder="Device name (e.g. MacBook, Pixel)"
                      value={deviceLabel}
                      onChange={(e) => setDeviceLabel(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button onClick={handlePasskeySetup} disabled={busy} className="w-full">
                      {busy ? 'Waiting for authenticator…' : 'Continue with passkey'}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Passkey ready on this device. One last thing — set the vault password below.
                      It&apos;s what lets a <b>different</b> device (your phone, a new laptop) join later.
                    </p>
                    <Input type="password" placeholder="Vault password (12+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { pendingPk.prfOutput.fill(0); setPendingPk(null); setPassword(''); setConfirm('') }} disabled={busy} className="shrink-0">
                        Back
                      </Button>
                      <Button onClick={handlePasskeyFinalize} disabled={busy} className="w-full">
                        {busy ? 'Creating…' : 'Create my vault'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
                This browser can&apos;t do passkeys — password it is. You can add a passkey later from another device.
              </p>
            )}
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold flex items-center gap-2"><KeyRound size={15} /> Password</p>
              <Input type="password" placeholder="Vault password (12+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <Button variant={isWebAuthnAvailable() ? 'outline' : 'default'} onClick={handlePasswordSetup} disabled={busy} className="w-full">
                {busy ? 'Creating…' : 'Create vault with password'}
              </Button>
            </div>
            <Button variant="ghost" onClick={skip} className="w-full text-muted-foreground">
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'recovery' && vault.recoveryCode && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <TriangleAlert size={16} /> Save this recovery code
            </CardTitle>
            <CardDescription>
              The only way back if you lose every unlock. We cannot reset it for you — type it below to prove you saved it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-lg tracking-wider select-all">{vault.recoveryCode}</p>
            <Input
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="font-mono"
            />
            <Button
              onClick={() => router.replace('/dashboard')}
              disabled={normalizeRecoveryCode(confirmCode) !== normalizeRecoveryCode(vault.recoveryCode)}
              className="w-full"
            >
              I saved it — open my dashboard <ArrowRight size={14} className="ml-2" />
            </Button>
            {warn && <p className="text-xs text-amber-500">{warn}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

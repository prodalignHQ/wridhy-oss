"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Pill({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
        dark ? "bg-white/15 text-white" : "bg-muted text-foreground/70"
      )}
    >
      {children}
    </span>
  )
}

function Card({
  emoji,
  title,
  children,
  dark = false,
}: {
  emoji: string
  title: string
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-5 sm:p-6",
        dark ? "border-[#18181b] bg-[#18181b] text-white dark:border-zinc-700" : "border-border bg-card"
      )}
    >
      <p className="text-3xl">{emoji}</p>
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      <div className={cn("mt-2 space-y-2 text-sm leading-relaxed", dark ? "text-white/80" : "text-muted-foreground")}>
        {children}
      </div>
    </div>
  )
}

// ─── Non-tech section ────────────────────────────────────────────────────────

function Everyone() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card emoji="📱" title="1. This device">
          <p>
            Your statements are read, cleaned, labelled, and charted <b>on your own phone or laptop</b> — the same
            way a calculator works on paper in front of you.
          </p>
          <p>Turn off the internet and everything still works.</p>
        </Card>
        <Card emoji="🏠" title="2. Your own server">
          <p>
            Want backup or family sharing? Run MoMoney on <b>your own computer or server</b>. Your data sits in a
            database you control — not ours.
          </p>
          <p>We never see it, because it never comes to us.</p>
        </Card>
        <Card emoji="☁️" title="3. Managed sync — coming soon" dark>
          <p>
            Don&apos;t want to run a server? Our upcoming sync service will back up your data — but <b>scrambled with
            a key only you hold</b>.
          </p>
          <p>We&apos;ll store a locked safe. We&apos;ll never have the key.</p>
        </Card>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-8">
        <h3 className="text-xl font-bold">🔍 What can MoMoney actually see?</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4">Thing</th>
                <th className="py-2 pr-4">Can we see it?</th>
                <th className="py-2">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {[
                ["Your transactions & balances", "❌ Never", "Encrypted on your device before anything leaves it."],
                ["Your password / recovery code", "❌ Never", "They unlock your data locally; they are never sent anywhere."],
                ["Your passkey", "❌ Never", "It lives in your phone's secure chip. We only get a yes/no."],
                ["Your email address", "✅ Yes (managed mode)", "Needed to log you in — same as any app. Nothing else is attached to it."],
                ["Scrambled backup blob", "✅ Yes, but useless", "It's ciphertext. Without your key it's random noise."],
              ].map(([thing, see, why]) => (
                <tr key={thing}>
                  <td className="py-2.5 pr-4 font-semibold text-foreground">{thing}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{see}</td>
                  <td className="py-2.5 text-muted-foreground">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card emoji="🔑" title="Unlock with your face, not your memory">
          <p>
            Your vault can open with a <b>passkey</b> (Face ID, fingerprint, PIN) — nothing to remember, nothing to
            phish. A password works too, and you get a <b>recovery code</b> to write down and keep somewhere safe.
          </p>
        </Card>
        <Card emoji="⚠️" title="One honest warning">
          <p>
            Because only you hold the key, <b>we cannot reset it for you</b>. Lose your password, recovery code,{" "}
            <i>and</i> passkey, and the scrambled backup stays scrambled forever.
          </p>
          <p>That&apos;s not a limitation — that&apos;s the proof it works.</p>
        </Card>
      </div>
    </div>
  )
}

// ─── Tech section ────────────────────────────────────────────────────────────

function Technical() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-8">
        <h3 className="text-xl font-bold">🔐 Key hierarchy (all client-side)</h3>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[#18181b] p-4 font-mono text-xs leading-relaxed text-emerald-200 dark:bg-black">
{`password ──Argon2id(salt, 3×64MiB)──▶ KEK-pw ──┐
passkey PRF output (32 B) ───────────────────▶ KEK-prf ──┼─ secretbox ─▶ DEK (32 B random)
recovery code ──Argon2id(salt)──────────▶ KEK-rec ───────┘
DEK ──XChaCha20-Poly1305──▶ snapshot ciphertext`}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill>hash-wasm Argon2id</Pill>
          <Pill>@noble/ciphers XChaCha20-Poly1305</Pill>
          <Pill>XSalsa20-Poly1305 secretbox wraps</Pill>
          <Pill>WebAuthn PRF extension</Pill>
          <Pill>Zero deps, Worker-safe</Pill>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card emoji="📦" title="Envelope formats">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Snapshot: canonical JSON → <code>XChaCha20-Poly1305(DEK)</code> → base64 <code>cipher</code> + 24-B{" "}
              <code>nonce</code>.
            </li>
            <li>
              Key wraps: base64 <code>nonce24 ‖ secretbox(DEK, KEK)</code> per path (password / PRF / recovery).
            </li>
            <li>
              PRF input: <code>SHA-256(&quot;MoMoney-Vault-PRF-v1&quot; ‖ salt)</code> — deterministic, no extra
              server column.
            </li>
            <li>
              DEK lives in memory only, wiped (<code>fill(0)</code>) on lock. Never persisted.
            </li>
          </ul>
        </Card>
        <Card emoji="🗄️" title="Server schema (managed mode)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              One row/user in <code>vault_blobs</code>: <code>cipher, nonce, salt, opslimit, memlimit,
              wrapped_dek_password, wrapped_dek_prf, prf_credential_id, wrapped_dek_recovery</code>.
            </li>
            <li>
              <code>GET|PUT|DELETE /v1/vault</code> — no decrypt path exists server-side. Auth-scoped, ~20 MB cap.
            </li>
            <li>
              Plaintext server-side: login email only (routing + auth). Everything content-bearing is ciphertext.
            </li>
            <li>
              Regression: <code>apps/api/vault-e2e.mts</code> (signup → PUT → GET → client-decrypt → DELETE).
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card emoji="💾" title="On-device store">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>wa-sqlite sync build + OPFS VFS in a dedicated Worker; all 11 tables cached locally.</li>
            <li>
              Lock seals <code>momoney.db → momoney.db.sealed</code> (XChaCha20-Poly1305, same DEK); unlock unseals.
            </li>
            <li>Import is OPFS-first; server upload is backup, converged by dedupHash (idempotency key).</li>
            <li>Next step: SQLite3MC custom build for page-level encryption (<code>PRAGMA key</code>).</li>
          </ul>
        </Card>
        <Card emoji="🎯" title="Threat model" dark>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>✅ Curious host, DB breach, backup leak, passive network observer, locked-device theft.</li>
            <li>⚠️ Out of scope: compromised client bundle (needs reproducible builds + SRI), unlocked-device access, malware, metadata (email, blob size/timing).</li>
            <li>🔑 Lost password + lost recovery code + lost passkey = unrecoverable, by design.</li>
          </ul>
        </Card>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-border p-5 sm:p-6">
        <h3 className="font-bold">🧭 Audit pointers</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Trusted client path (~1.5k lines): <code>packages/local-engine/src/crypto.ts</code>,{" "}
          <code>apps/web/lib/engine/webauthn-prf.ts</code>, <code>vault-sync.ts</code>,{" "}
          <code>apps/api/src/routes/vault.ts</code>. Full story:{" "}
          <code>docs/dev/done/001-local-first-encrypted-vault.md</code>.
        </p>
      </div>
    </div>
  )
}

// ─── Page shell with tabs ────────────────────────────────────────────────────

export default function PrivacyTabs() {
  const [tab, setTab] = useState<"everyone" | "technical">("everyone")

  return (
    <div>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-[#10b981]/15 blur-3xl" />
          <div className="absolute top-10 -right-20 h-72 w-72 rounded-full bg-[#0ea5e9]/15 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 md:pt-16">
          <div className="mb-4 inline-flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              🔒 100% private by design
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              🛡️ Zero-knowledge sync — coming soon
            </span>
          </div>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Private means <span className="text-primary">we can&apos;t see it</span>, not that we promise not to look.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            MoMoney reads your money on your device, and scrambles anything that leaves it. Here&apos;s exactly how —
            pick your depth.
          </p>
          <div className="mt-6 inline-flex rounded-xl border-2 border-border bg-card p-1">
            {(
              [
                { id: "everyone", label: "👋 In plain English" },
                { id: "technical", label: "🧑‍💻 Technical" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
                  tab === t.id ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {tab === "everyone" ? <Everyone /> : <Technical />}
        <div className="mt-8 rounded-2xl bg-primary p-6 text-center text-white sm:p-8">
          <h2 className="text-xl font-bold sm:text-2xl">Your money. Your device. Your key.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
            Self-host today for full control — or wait for zero-knowledge sync where we hold a safe we can never open.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-6 py-3 text-[15px] font-bold text-primary transition-transform hover:-translate-y-0.5"
            >
              Open MoMoney →
            </Link>
            <Link
              href="/"
              className="rounded-xl border-2 border-white/30 px-6 py-3 text-[15px] font-bold text-white hover:bg-white/10"
            >
              Back home
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

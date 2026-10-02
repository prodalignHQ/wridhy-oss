'use client'

// ─── "Does this account have a vault yet?" ───────────────────────────────────
// Vault setup should only be offered to someone who has not done it. Two
// consumers need that answer — the Settings card and the sidebar row — so the
// probe is shared at module scope rather than each firing its own request.
//
// Returns:
//   true   a vault exists
//   false  no vault — offer setup
//   null   not known yet, or we could not tell (offline). Consumers should
//          offer nothing rather than guess: a redundant "set up a vault" on
//          someone who already has one is worse than a missing one.

import { useEffect, useState } from 'react'

/** Fired when the answer changes without a page load, e.g. right after setup. */
const PRESENCE_EVENT = 'momoney:vault-presence'

let cached: boolean | null = null
let inflight: Promise<boolean | null> | null = null

function probe(): Promise<boolean | null> {
  if (cached !== null) return Promise.resolve(cached)
  if (!inflight) {
    // Lazy: vault-sync pulls in the whole crypto path, and chrome should not
    // drag Argon2 into every page render.
    inflight = import('@/lib/engine/vault-sync')
      .then(({ fetchVaultBlob }) =>
        // NO_VAULT surfaces as null; anything else (network, 500) is "unknown",
        // not "no vault".
        fetchVaultBlob().then(
          (blob) => !!blob,
          () => null
        )
      )
      .catch(() => null)
      .then((result) => {
        if (result !== null) cached = result
        inflight = null
        return result
      })
  }
  return inflight
}

/** Record a known answer and tell mounted consumers. Call after create/delete. */
export function setVaultPresence(hasVault: boolean): void {
  cached = hasVault
  inflight = null
  try {
    window.dispatchEvent(new CustomEvent(PRESENCE_EVENT))
  } catch {
    // non-DOM runtimes — nothing to notify
  }
}

/** Drop the cache so the next consumer re-checks the server. */
export function resetVaultPresence(): void {
  cached = null
  inflight = null
}

export function useHasVault(): boolean | null {
  const [known, setKnown] = useState<boolean | null>(() => cached)

  useEffect(() => {
    let cancelled = false
    const onChange = () => {
      if (!cancelled) setKnown(cached)
    }
    window.addEventListener(PRESENCE_EVENT, onChange)
    probe().then((result) => {
      if (!cancelled) setKnown(result)
    })
    return () => {
      cancelled = true
      window.removeEventListener(PRESENCE_EVENT, onChange)
    }
  }, [])

  return known
}

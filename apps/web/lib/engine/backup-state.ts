// ─── Backup dirtiness (synchronous) ──────────────────────────────────────────
// Whether an encrypted backup is outstanding RIGHT NOW. hasPendingWork() reads
// OPFS/localStorage (async) — unusable in a beforeunload handler, which must
// decide synchronously whether closing the tab would lose data. This flag is
// the sync mirror: set whenever a local edit schedules a backup, cleared on
// every successful backup (markBackupComplete) and after every flush attempt.
// Zero dependencies by design (imported by stores and triggers alike).

let dirty = false

/** A local edit is awaiting its debounced encrypted backup. */
export function markBackupDirty(): void {
  dirty = true
}

/** No backup outstanding (backup succeeded or flush found nothing to do). */
export function markBackupClean(): void {
  dirty = false
}

/** Sync check for unload guards. True only between edit and backup. */
export function isBackupDirty(): boolean {
  return dirty
}

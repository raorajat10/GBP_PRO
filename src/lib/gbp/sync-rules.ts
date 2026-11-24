/** Which profiles the daily sync refreshes. Pure, unit-tested. */

export interface SyncCandidate {
  id: string;
  syncedAt: string;
  connectionStatus: string;
  clientStatus: string;
}

/** Synced within this many hours: skip (someone pressed "Sync now", or a run overlapped). */
export const FRESH_HOURS = 20;

/** Active clients with a working Google connection, not synced recently, oldest first. */
export function dueForSync(candidates: SyncCandidate[], now: Date): SyncCandidate[] {
  const cutoff = now.getTime() - FRESH_HOURS * 3_600_000;
  return candidates
    .filter(
      (c) =>
        c.clientStatus === "active" &&
        c.connectionStatus === "connected" &&
        Date.parse(c.syncedAt) < cutoff,
    )
    .sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));
}

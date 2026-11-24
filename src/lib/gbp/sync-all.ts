import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncLocation } from "./service";
import { dueForSync, type SyncCandidate } from "./sync-rules";

/**
 * Daily refresh of every linked profile: reviews, photos, posts, numbers and the score.
 * Oldest first, within a time budget, so one run never times out; anything left over is
 * picked up by the next run. Each profile is independent: one failure doesn't stop the rest.
 */
export async function syncDueLocations(opts: { budgetMs?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();

  const { data } = await createSupabaseAdminClient()
    .from("locations")
    .select("id, synced_at, connection:gbp_connections(status), client:clients(status)")
    .order("synced_at")
    .limit(200);
  const candidates: SyncCandidate[] = (data ?? []).map((l) => ({
    id: l.id,
    syncedAt: l.synced_at,
    connectionStatus: l.connection?.status ?? "error",
    clientStatus: l.client?.status ?? "churned",
  }));

  const result = { synced: 0, failed: 0, skipped: 0, remaining: 0 };
  const due = dueForSync(candidates, now);
  result.skipped = candidates.length - due.length;
  for (const [i, loc] of due.entries()) {
    if (Date.now() - started > budgetMs) {
      result.remaining = due.length - i;
      break;
    }
    try {
      await syncLocation(loc.id);
      result.synced++;
    } catch (e) {
      // syncLocation already flags connections whose Google access was removed.
      console.error(`Daily sync failed for location ${loc.id}`, e);
      result.failed++;
    }
  }
  return result;
}

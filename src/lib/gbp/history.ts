import "server-only";
import { notifyClient } from "@/lib/notifications/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DailyMetrics, GbpReview } from "./types";

/**
 * Keep every synced review and the daily Google numbers in their own tables, so the
 * owner's Reviews and Analytics pages can filter and chart them. Secret-key writes:
 * call only after the caller's access has been checked (same rule as service.ts).
 */
export async function saveProfileHistory(input: {
  locationId: string;
  clientId: string;
  reviews: GbpReview[];
  metrics: DailyMetrics[];
  /** False on the first link, so a new client isn't told about years of "new" reviews. */
  notifyNewReviews: boolean;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  if (input.reviews.length) {
    let fresh: GbpReview[] = [];
    if (input.notifyNewReviews) {
      const { data: known } = await admin
        .from("reviews")
        .select("gbp_review_name")
        .eq("location_id", input.locationId);
      const seen = new Set((known ?? []).map((r) => r.gbp_review_name));
      fresh = input.reviews.filter((r) => !seen.has(r.name));
    }
    const { error } = await admin.from("reviews").upsert(
      input.reviews.map((r) => ({
        location_id: input.locationId,
        client_id: input.clientId,
        gbp_review_name: r.name,
        reviewer: r.reviewer,
        star_rating: r.starRating,
        comment: r.comment,
        reviewed_at: r.createTime,
        reply_comment: r.reply?.comment ?? null,
        replied_at: r.reply?.updateTime ?? null,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "gbp_review_name" },
    );
    if (error) throw new Error(`Couldn't save reviews: ${error.message}`);
    if (fresh.length) {
      const low = fresh.filter((r) => r.starRating <= 3).length;
      await notifyClient({
        clientId: input.clientId,
        kind: "review",
        title: fresh.length === 1 ? "1 new Google review" : `${fresh.length} new Google reviews`,
        body: low ? `${low} of them ${low === 1 ? "is" : "are"} 3 stars or lower.` : "",
        link: "/home/reviews",
      });
    }
  }

  if (input.metrics.length) {
    const { error } = await admin.from("location_metrics_daily").upsert(
      input.metrics.map((m) => ({
        location_id: input.locationId,
        client_id: input.clientId,
        day: m.date,
        impressions_search: m.impressionsSearch,
        impressions_maps: m.impressionsMaps,
        calls: m.calls,
        direction_requests: m.directionRequests,
        website_clicks: m.websiteClicks,
      })),
      { onConflict: "location_id,day" },
    );
    if (error) throw new Error(`Couldn't save daily metrics: ${error.message}`);
  }
}

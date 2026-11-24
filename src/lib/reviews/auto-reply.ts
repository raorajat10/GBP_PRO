import "server-only";
import type { Language } from "@/lib/clients/schema";
import { locationTarget } from "@/lib/gbp/service";
import { GbpError } from "@/lib/gbp/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reviewsToAutoReply } from "./auto-reply-rules";
import { replyLanguage } from "./language";
import { thankYouReplies } from "./thank-you";

/**
 * Post the ready-made thank-you on new good reviews of one profile, if the client switched
 * auto reply on. Runs after each sync. Secret-key client: called only from trusted server
 * code (the sync), never with input from a browser.
 */
export async function autoReplyForLocation(
  locationId: string,
): Promise<{ posted: number; failed: number }> {
  const admin = createSupabaseAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select(
      "client:clients(business_name, preferred_language, auto_reply_since, auto_reply_min_stars, status)",
    )
    .eq("id", locationId)
    .single();
  const client = loc?.client;
  if (!client?.auto_reply_since || client.status !== "active") return { posted: 0, failed: 0 };

  const { data: rows } = await admin
    .from("reviews")
    .select("id, gbp_review_name, reviewer, star_rating, comment, reviewed_at, replied_at")
    .eq("location_id", locationId)
    .is("replied_at", null)
    .gte("reviewed_at", client.auto_reply_since)
    .gte("star_rating", client.auto_reply_min_stars)
    .order("reviewed_at")
    .limit(100);
  const due = reviewsToAutoReply(
    (rows ?? []).map((r) => ({
      id: r.id,
      starRating: r.star_rating,
      reviewedAt: r.reviewed_at,
      hasReply: r.replied_at != null,
    })),
    { since: client.auto_reply_since, minStars: client.auto_reply_min_stars },
  );
  if (!due.length) return { posted: 0, failed: 0 };

  const target = await locationTarget(locationId);
  const result = { posted: 0, failed: 0 };
  for (const d of due) {
    const r = rows!.find((x) => x.id === d.id)!;
    const [reply] = thankYouReplies({
      reviewer: r.reviewer,
      stars: r.star_rating,
      business: client.business_name,
      language: replyLanguage(r.comment, (client.preferred_language as Language) ?? "en"),
    });
    try {
      const saved = await target.provider.replyToReview(
        target.creds,
        r.gbp_review_name,
        reply.text,
      );
      await admin
        .from("reviews")
        .update({ reply_comment: saved.comment, replied_at: saved.updateTime, replied_by: "auto" })
        .eq("id", r.id);
      result.posted++;
    } catch (e) {
      result.failed++;
      console.error(`Auto reply failed for review ${r.id}`, e);
      if (e instanceof GbpError && e.kind === "auth") {
        await target.onAuthError(e);
        break; // access is gone: the rest would fail too
      }
    }
  }
  return result;
}

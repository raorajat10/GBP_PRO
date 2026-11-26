import "server-only";
import type { Language } from "@/lib/clients/schema";
import { locationTarget } from "@/lib/gbp/service";
import { GbpError } from "@/lib/gbp/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BACKLOG_BATCH, reviewsToAutoReply } from "./auto-reply-rules";
import { replyLanguage } from "./language";
import { thankYouReplies } from "./thank-you";

/**
 * Ready-made thank-you replies posted on Google: automatically after each sync (auto
 * reply), or for the old backlog on request. Secret-key client: callers are the sync or
 * an action that has already checked the user's access to the client.
 */

interface ReviewRow {
  id: string;
  gbp_review_name: string;
  reviewer: string;
  star_rating: number;
  comment: string | null;
}

interface ClientInfo {
  business_name: string;
  preferred_language: string;
}

const REVIEW_FIELDS =
  "id, gbp_review_name, reviewer, star_rating, comment, reviewed_at, replied_at";

/** Post the first thank-you option on each review, in its language. Stops if access is gone. */
async function postThankYous(
  locationId: string,
  client: ClientInfo,
  rows: ReviewRow[],
): Promise<{ posted: number; failed: number }> {
  const admin = createSupabaseAdminClient();
  const target = await locationTarget(locationId);
  const result = { posted: 0, failed: 0 };
  for (const r of rows) {
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
      console.error(`Thank-you reply failed for review ${r.id}`, e);
      if (e instanceof GbpError && e.kind === "auth") {
        await target.onAuthError(e);
        break; // access is gone: the rest would fail too
      }
    }
  }
  return result;
}

/** After a sync: thank new good reviews, if the client switched auto reply on. */
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
    .select(REVIEW_FIELDS)
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
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return postThankYous(
    locationId,
    client,
    due.map((d) => byId.get(d.id)!),
  );
}

async function backlogQuery(clientId: string, minStars: number) {
  const admin = createSupabaseAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("business_name, preferred_language, status, locations(id, created_at)")
    .eq("id", clientId)
    .single();
  const loc = client?.locations.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  return {
    admin,
    client,
    locationId: loc?.id ?? null,
    minStars: Math.max(3, Math.min(5, minStars)),
  };
}

/** How many old good reviews still have no reply (what the button would answer). */
export async function countUnansweredGood(clientId: string, minStars: number): Promise<number> {
  const { admin, locationId, minStars: min } = await backlogQuery(clientId, minStars);
  if (!locationId) return 0;
  const { count } = await admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .is("replied_at", null)
    .gte("star_rating", min);
  return count ?? 0;
}

/**
 * "Thank all unanswered good reviews": the backlog auto reply leaves alone. Newest first,
 * up to BACKLOG_BATCH per press; low ratings are never included.
 */
export async function thankUnansweredGood(
  clientId: string,
  minStars: number,
): Promise<{ posted: number; failed: number; remaining: number }> {
  const { admin, client, locationId, minStars: min } = await backlogQuery(clientId, minStars);
  if (!client || client.status !== "active" || !locationId) {
    throw new GbpError("Link this business's Google profile first.", "not_found");
  }
  const { data: rows } = await admin
    .from("reviews")
    .select(REVIEW_FIELDS)
    .eq("location_id", locationId)
    .is("replied_at", null)
    .gte("star_rating", min)
    .order("reviewed_at", { ascending: false })
    .limit(BACKLOG_BATCH);
  if (!rows?.length) return { posted: 0, failed: 0, remaining: 0 };
  const result = await postThankYous(locationId, client, rows);
  return { ...result, remaining: await countUnansweredGood(clientId, min) };
}

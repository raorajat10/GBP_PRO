import "server-only";
import { locationTarget } from "@/lib/gbp/service";
import { GbpError, type PostCtaType } from "@/lib/gbp/types";
import { notifyClient } from "@/lib/notifications/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextAttempt } from "./publish-rules";

/**
 * M8: publish approved posts to Google. Only posts in "scheduled" can be picked up, and
 * the database refuses "scheduled"/"published" without the owner's approval, so nothing
 * unapproved can ever go out. Uses the secret-key client: callers are the cron route, the
 * owner's approval, or a team member already checked for this client.
 */

const PHOTO_LINK_SECONDS = 60 * 60;
const BATCH = 20;

export type PublishOutcome =
  | { postId: string; result: "published"; gbpPostName: string }
  | { postId: string; result: "retry"; error: string; nextAt: string }
  | { postId: string; result: "failed"; error: string }
  | { postId: string; result: "skipped"; reason?: "no_profile" };

const LANGUAGE_CODE: Record<string, string> = { en: "en", hi: "hi", hinglish: "en" };

/** Publish every post that is due now (oldest first), up to a batch. */
export async function publishDuePosts(now = new Date()): Promise<PublishOutcome[]> {
  const { data } = await createSupabaseAdminClient()
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for")
    .limit(BATCH);
  const out: PublishOutcome[] = [];
  // One at a time: posts are few, and it keeps us well inside Google's rate limits.
  for (const p of data ?? []) out.push(await publishPost(p.id, now));
  return out;
}

/** Publish one post if it is scheduled and due. Safe to call twice: only one call wins. */
export async function publishPost(postId: string, now = new Date()): Promise<PublishOutcome> {
  const admin = createSupabaseAdminClient();
  // No linked Google profile yet: leave it scheduled; it goes out once one is linked.
  const { data: pre } = await admin
    .from("posts")
    .select("client_id, location_id")
    .eq("id", postId)
    .maybeSingle();
  if (!pre) return { postId, result: "skipped" };
  let locationId = pre.location_id;
  if (!locationId) {
    const { data: loc } = await admin
      .from("locations")
      .select("id")
      .eq("client_id", pre.client_id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    locationId = loc?.id ?? null;
  }
  if (!locationId) return { postId, result: "skipped", reason: "no_profile" };

  // Claim it: only one runner can move it from scheduled to publishing.
  const { data: post } = await admin
    .from("posts")
    .update({ status: "publishing" })
    .eq("id", postId)
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .select(
      "id, client_id, body, language, cta_type, cta_url, publish_attempts, media:media_assets(storage_path)",
    )
    .maybeSingle();
  if (!post) return { postId, result: "skipped" };

  const attempts = post.publish_attempts + 1;
  try {
    let photoUrl: string | null = null;
    if (post.media) {
      const { data } = await admin.storage
        .from("media")
        .createSignedUrl(post.media.storage_path, PHOTO_LINK_SECONDS);
      if (!data?.signedUrl) throw new GbpError("Couldn't prepare the photo for Google.");
      photoUrl = data.signedUrl;
    }

    const target = await locationTarget(locationId);
    let created;
    try {
      created = await target.provider.createLocalPost(target.creds, target.locationName, {
        summary: post.body,
        languageCode: LANGUAGE_CODE[post.language] ?? "en",
        cta: post.cta_type ? { type: post.cta_type as PostCtaType, url: post.cta_url } : null,
        photoUrl,
      });
    } catch (e) {
      await target.onAuthError(e);
      throw e;
    }
    if (created.state === "REJECTED") {
      throw new GbpError(
        "Google rejected this post. Check the text and photo, then try again.",
        "not_found",
      );
    }

    await admin
      .from("posts")
      .update({
        status: "published",
        published_at: now.toISOString(),
        gbp_post_name: created.name,
        publish_attempts: attempts,
        error: null,
      })
      .eq("id", post.id);
    await notifyClient({
      clientId: post.client_id,
      kind: "general",
      title: "Your post is live on Google",
      body: post.body.slice(0, 140),
      link: "/home/grow/posts",
    });
    return { postId, result: "published", gbpPostName: created.name };
  } catch (e) {
    const message = e instanceof GbpError ? e.message : "Couldn't reach Google.";
    if (!(e instanceof GbpError)) console.error("Publishing failed", e);
    const next = nextAttempt({
      attempts,
      permanent:
        e instanceof GbpError &&
        (e.kind === "auth" || e.kind === "not_found" || /refused/.test(e.message)),
      now,
    });
    await admin
      .from("posts")
      .update(
        next
          ? { status: "scheduled", scheduled_for: next, publish_attempts: attempts, error: message }
          : { status: "failed", publish_attempts: attempts, error: message },
      )
      .eq("id", post.id);
    return next
      ? { postId, result: "retry", error: message, nextAt: next }
      : { postId, result: "failed", error: message };
  }
}

/**
 * Team "Publish now" / "Try again": puts an approved post (scheduled or failed) back in
 * line for right now and publishes it. Caller has checked the team member's access.
 */
export async function publishNow(postId: string): Promise<PublishOutcome> {
  const now = new Date();
  const { data } = await createSupabaseAdminClient()
    .from("posts")
    .update({ status: "scheduled", scheduled_for: now.toISOString(), publish_attempts: 0 })
    .eq("id", postId)
    .in("status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();
  if (!data) return { postId, result: "skipped" };
  return publishPost(postId, now);
}

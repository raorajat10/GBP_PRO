import "server-only";
import { SLUG_PATTERN } from "@/lib/clients/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normaliseSlug(rawSlug: string) {
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  } catch {
    return null; // malformed %-encoding
  }
  return slug.length >= 2 && slug.length <= 60 && SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Looks up an active client for the public (no login) pages at /reply-studio/<slug> and
 * /review/<slug>. Returns only public facts — nothing private. Paused or departed
 * clients get "not found", so their pages switch off without deleting anything.
 */
export async function getPublicClient(rawSlug: string) {
  const slug = normaliseSlug(rawSlug);
  if (!slug) return null;

  const { data } = await createSupabaseAdminClient()
    .from("clients")
    .select(
      "id, slug, business_name, google_review_link, reply_link, locations(review_url, place_id)",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;

  // The link typed on the client page wins; otherwise a linked Google profile's link
  // (ignoring sample-data profiles, whose place IDs aren't real).
  const synced = data.locations.find((l) => l.review_url && !l.place_id?.startsWith("SAMPLE_"));
  return {
    id: data.id,
    slug: data.slug,
    name: data.business_name,
    reviewUrl: data.google_review_link ?? synced?.review_url ?? null,
    replyUrl: data.reply_link ?? null,
  };
}

/** Reply studio needs the name and where to paste a copied reply. */
export async function getPublicReplyStudioClient(rawSlug: string) {
  const client = await getPublicClient(rawSlug);
  return client ? { slug: client.slug, name: client.name, replyUrl: client.replyUrl } : null;
}

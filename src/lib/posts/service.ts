import "server-only";
import { getPostWriter } from "@/lib/ai/claude";
import type { PostDraftRequest } from "@/lib/ai/writer";
import type { Language } from "@/lib/clients/schema";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processPhoto } from "./photo";
import { EDITABLE_STATUSES, isEditable, postIssues, type CtaType, type TopicType } from "./rules";

/**
 * Post drafts. Writes use the secret-key client, so callers must check the user may
 * manage the client first (same rule as src/lib/gbp/service.ts).
 */

export class PostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostError";
  }
}

const BUCKET = "media";
const SIGNED_URL_SECONDS = 60 * 60;

export interface DraftOption {
  angle: string;
  body: string;
}

async function businessFor(clientId: string): Promise<{
  business: PostDraftRequest["business"];
  locationId: string | null;
  website: string | null;
}> {
  const admin = createSupabaseAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("business_name, industry, brand_notes, locations(id, website, snapshot, created_at)")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) throw new PostError("Client not found.");
  const loc = [...client.locations].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const p = (loc?.snapshot as unknown as LocationSnapshot | undefined)?.profile;
  return {
    locationId: loc?.id ?? null,
    website: loc?.website ?? null,
    business: {
      title: p?.title ?? client.business_name,
      category: p?.primaryCategory?.displayName ?? null,
      area: p?.address?.addressLines.at(-1) ?? null,
      city: p?.address?.locality ?? null,
      industry: client.industry,
      services: p?.services ?? [],
      brandNotes: client.brand_notes,
    },
  };
}

async function photoForAi(storagePath: string): Promise<PostDraftRequest["photo"]> {
  const { data } = await createSupabaseAdminClient().storage.from(BUCKET).download(storagePath);
  if (!data) return null;
  return {
    base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
    mediaType: "image/jpeg",
  };
}

/** Save the photo, ask the writer for drafts, and create a draft post. */
export async function createPostWithDrafts(input: {
  clientId: string;
  userId: string;
  photo: Buffer | null;
  note: string;
  language: Language;
  topicType: TopicType;
}): Promise<{ postId: string }> {
  const admin = createSupabaseAdminClient();
  const { business, locationId, website } = await businessFor(input.clientId);

  let mediaId: string | null = null;
  let photo: PostDraftRequest["photo"] = null;
  if (input.photo) {
    const processed = await processPhoto(input.photo);
    const path = `${input.clientId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, processed.jpeg, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw new PostError("Couldn't save the photo. Try again.");
    const { data: media, error: mErr } = await admin
      .from("media_assets")
      .insert({
        client_id: input.clientId,
        storage_path: path,
        mime: "image/jpeg",
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        uploaded_by: input.userId,
      })
      .select("id")
      .single();
    if (mErr || !media) {
      await admin.storage.from(BUCKET).remove([path]);
      throw new PostError("Couldn't save the photo. Try again.");
    }
    mediaId = media.id;
    photo = { base64: processed.jpeg.toString("base64"), mediaType: "image/jpeg" };
  }

  const removePhoto = async () => {
    if (!mediaId) return;
    const { data: m } = await admin
      .from("media_assets")
      .delete()
      .eq("id", mediaId)
      .select("storage_path")
      .single();
    if (m) await admin.storage.from(BUCKET).remove([m.storage_path]);
  };

  let result;
  try {
    result = await getPostWriter().writePostDrafts({
      business,
      note: input.note,
      language: input.language,
      topicType: input.topicType,
      photo,
    });
  } catch (e) {
    await removePhoto();
    throw e;
  }

  const { data: post, error } = await admin
    .from("posts")
    .insert({
      client_id: input.clientId,
      location_id: locationId,
      status: "draft",
      language: input.language,
      topic_type: input.topicType,
      body: result.drafts[0].body,
      cta_type: website ? "LEARN_MORE" : "CALL",
      cta_url: website?.startsWith("https://") ? website : null,
      media_asset_id: mediaId,
      source_note: input.note,
      ai_drafts: result.drafts as unknown as Json,
      ai_model: result.model,
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !post) {
    await removePhoto();
    throw new PostError("Couldn't save the draft. Try again.");
  }
  return { postId: post.id };
}

/** Write a fresh set of drafts for an existing draft post (e.g. in another language). */
export async function regenerateDrafts(input: {
  postId: string;
  language: Language;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, client_id, status, source_note, topic_type, media:media_assets(storage_path)")
    .eq("id", input.postId)
    .maybeSingle();
  if (!post) throw new PostError("Post not found.");
  if (!isEditable(post.status)) throw new PostError("This post can't be changed now.");

  const { business } = await businessFor(post.client_id);
  const result = await getPostWriter().writePostDrafts({
    business,
    note: post.source_note,
    language: input.language,
    topicType: post.topic_type as TopicType,
    photo: post.media ? await photoForAi(post.media.storage_path) : null,
  });
  const { error } = await admin
    .from("posts")
    .update({
      language: input.language,
      ai_drafts: result.drafts as unknown as Json,
      ai_model: result.model,
      body: result.drafts[0].body,
    })
    .eq("id", post.id)
    .in("status", [...EDITABLE_STATUSES]);
  if (error) throw new PostError("Couldn't save the new drafts.");
}

export async function savePostDraft(input: {
  postId: string;
  body: string;
  ctaType: CtaType | null;
  ctaUrl: string | null;
  scheduledFor: Date | null;
}): Promise<void> {
  const body = input.body.trim();
  if (postIssues(body).length) throw new PostError("The post breaks a posting rule.");
  const { data, error } = await createSupabaseAdminClient()
    .from("posts")
    .update({
      body,
      cta_type: input.ctaType,
      cta_url: input.ctaType && input.ctaType !== "CALL" ? input.ctaUrl : null,
      scheduled_for: input.scheduledFor?.toISOString() ?? null,
    })
    .eq("id", input.postId)
    .in("status", [...EDITABLE_STATUSES])
    .select("id");
  if (error) throw new PostError("Couldn't save the post. Try again.");
  if (!data?.length) {
    throw new PostError("This post is waiting for approval or scheduled, so it can't be edited.");
  }
}

export async function deletePostDraft(postId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, status, media_asset_id, media:media_assets(storage_path)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return;
  if (!isEditable(post.status)) {
    throw new PostError(
      "A post waiting for approval or scheduled can't be deleted. Cancel the request first.",
    );
  }
  const { error } = await admin.from("posts").delete().eq("id", postId);
  if (error) {
    console.error("Deleting post failed", error);
    throw new PostError("Couldn't delete the draft.");
  }
  if (post.media_asset_id && post.media) {
    // Each upload belongs to one post today, so remove the photo with its draft.
    await admin.from("media_assets").delete().eq("id", post.media_asset_id);
    await admin.storage.from(BUCKET).remove([post.media.storage_path]);
  }
}

/** The client a post belongs to (for permission checks), or null. */
export async function postClientId(postId: string): Promise<string | null> {
  const { data } = await createSupabaseAdminClient()
    .from("posts")
    .select("client_id")
    .eq("id", postId)
    .maybeSingle();
  return data?.client_id ?? null;
}

/** Short-lived links to private photos. Caller must have checked access to the client. */
export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map(
    (data ?? [])
      .filter((d) => d.signedUrl && d.path)
      .map((d) => [d.path as string, d.signedUrl as string]),
  );
}

export interface PostListItem {
  id: string;
  status: string;
  body: string;
  language: string;
  scheduledFor: string | null;
  createdAt: string;
  aiModel: string | null;
  photoUrl: string | null;
}

/** Posts of a client, newest first, read as the signed-in user (row-level security applies). */
export async function listPosts(clientId: string): Promise<PostListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id, status, body, language, scheduled_for, created_at, ai_model, media:media_assets(storage_path)",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  const posts = data ?? [];
  const urls = await signedPhotoUrls(
    posts.map((p) => p.media?.storage_path).filter((x): x is string => Boolean(x)),
  );
  return posts.map((p) => ({
    id: p.id,
    status: p.status,
    body: p.body,
    language: p.language,
    scheduledFor: p.scheduled_for,
    createdAt: p.created_at,
    aiModel: p.ai_model,
    photoUrl: p.media ? (urls.get(p.media.storage_path) ?? null) : null,
  }));
}

export interface PostDetail extends PostListItem {
  clientId: string;
  topicType: string;
  ctaType: string | null;
  ctaUrl: string | null;
  sourceNote: string;
  drafts: DraftOption[];
  locationLinked: boolean;
  website: string | null;
}

export async function getPost(postId: string): Promise<PostDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase
    .from("posts")
    .select(
      "id, client_id, status, body, language, topic_type, cta_type, cta_url, source_note, ai_drafts, ai_model, scheduled_for, created_at, location:locations(id, website), media:media_assets(storage_path)",
    )
    .eq("id", postId)
    .maybeSingle();
  if (!p) return null;
  const urls = await signedPhotoUrls(p.media ? [p.media.storage_path] : []);
  return {
    id: p.id,
    clientId: p.client_id,
    status: p.status,
    body: p.body,
    language: p.language,
    topicType: p.topic_type,
    ctaType: p.cta_type,
    ctaUrl: p.cta_url,
    sourceNote: p.source_note,
    drafts: (p.ai_drafts as unknown as DraftOption[]) ?? [],
    aiModel: p.ai_model,
    scheduledFor: p.scheduled_for,
    createdAt: p.created_at,
    photoUrl: p.media ? (urls.get(p.media.storage_path) ?? null) : null,
    locationLinked: Boolean(p.location),
    website: p.location?.website ?? null,
  };
}

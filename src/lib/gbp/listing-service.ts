import "server-only";
import { recordAudit } from "@/lib/audit/service";
import { notifyClient } from "@/lib/notifications/service";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyEdit, changedOnly, describeEdit, type ListingEdit } from "./listing-edit";
import { locationTarget } from "./service";
import type { LocationSnapshot } from "./snapshot";
import { GbpError, type MediaCategory } from "./types";

/**
 * Change a client's live Google profile (phone, website, description, hours) and keep our
 * stored copy and score in step. Secret-key writes: callers must have checked that the
 * user is the owner of this client or on its team.
 */
export async function editListing(input: {
  clientId: string;
  edit: ListingEdit;
  userId: string;
  by: "team" | "owner";
}): Promise<{ changed: string }> {
  const admin = createSupabaseAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select("id, snapshot")
    .eq("client_id", input.clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!loc) throw new GbpError("Link the Google profile first.", "not_found");
  const snapshot = loc.snapshot as unknown as LocationSnapshot;
  const edit = changedOnly(input.edit, snapshot.profile);
  if (!Object.keys(edit).length) return { changed: "" };

  const target = await locationTarget(loc.id);
  try {
    await target.provider.updateLocation(target.creds, target.locationName, edit);
  } catch (e) {
    await target.onAuthError(e);
    throw e;
  }

  // Google may take a few minutes to show the change; our copy shows it straight away and
  // the next sync reconciles with whatever Google finally publishes.
  const next: LocationSnapshot = { ...snapshot, profile: applyEdit(snapshot.profile, edit) };
  await admin
    .from("locations")
    .update({
      snapshot: next as unknown as NonNullable<Json>,
      ...(edit.phone !== undefined ? { phone: edit.phone } : {}),
      ...(edit.website !== undefined ? { website: edit.website } : {}),
    })
    .eq("id", loc.id);
  try {
    await recordAudit({
      locationId: loc.id,
      clientId: input.clientId,
      snapshot: next,
      userId: input.userId,
    });
  } catch (e) {
    console.error("Re-scoring after an edit failed", e);
  }

  const changed = describeEdit(edit);
  if (input.by === "team") {
    await notifyClient({
      clientId: input.clientId,
      kind: "general",
      title: "We updated your Google profile",
      body: `Changed: ${changed}.`,
      link: "/home/listing",
    });
  }
  return { changed };
}

const PHOTO_LINK_SECONDS = 60 * 60;

/** Team: add a photo the owner sent (post bank) to the Google profile's photos. */
export async function addPostBankPhotoToGoogle(input: {
  clientId: string;
  itemId: string;
  category: MediaCategory;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin
    .from("post_bank_items")
    .select("id, client_id, media:media_assets(storage_path)")
    .eq("id", input.itemId)
    .maybeSingle();
  if (!item || item.client_id !== input.clientId || !item.media) {
    throw new GbpError("Photo not found.", "not_found");
  }
  const { data: loc } = await admin
    .from("locations")
    .select("id")
    .eq("client_id", input.clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!loc) throw new GbpError("Link the Google profile first.", "not_found");
  const { data: signed } = await admin.storage
    .from("media")
    .createSignedUrl(item.media.storage_path, PHOTO_LINK_SECONDS);
  if (!signed?.signedUrl) throw new GbpError("Couldn't prepare the photo for Google.");

  const target = await locationTarget(loc.id);
  try {
    await target.provider.addPhoto(target.creds, target.locationName, {
      sourceUrl: signed.signedUrl,
      category: input.category,
    });
  } catch (e) {
    await target.onAuthError(e);
    throw e;
  }
  await admin.from("post_bank_items").update({ status: "used" }).eq("id", item.id);
  await notifyClient({
    clientId: input.clientId,
    kind: "general",
    title: "Your photo was added to Google",
    link: "/home/listing/photos",
  });
}

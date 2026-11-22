"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { PhotoError, PHOTO_RULES } from "@/lib/posts/photo";
import { PostError, storeClientPhoto } from "@/lib/posts/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const todayIst = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const schema = z.object({
  caption: z.string().trim().max(1000, "Keep the note under 1,000 characters."),
  wantedOn: z
    .union([z.literal(""), z.iso.date("Pick a valid date.")])
    .refine((d) => d === "" || d >= todayIst(), "Pick today or a later date."),
});

/**
 * Owner sends a photo (with an optional note and date) for our team to post on Google,
 * or to add to the profile's photos. Our team reviews every item before it goes anywhere.
 */
export async function addToPostBank(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const parsed = schema.safeParse({
    caption: fd.get("caption") ?? "",
    wantedOn: fd.get("wantedOn") ?? "",
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { photo: ["Choose a photo first."] } };
  }
  if (file.size > PHOTO_RULES.maxUploadBytes) {
    return { errors: { photo: ["That photo is too large. Use one under 4 MB."] } };
  }

  const { user, business } = await requireOwnerBusiness();
  let mediaId: string;
  try {
    ({ mediaId } = await storeClientPhoto({
      clientId: business.id,
      userId: user.id,
      photo: Buffer.from(await file.arrayBuffer()),
    }));
  } catch (e) {
    if (e instanceof PhotoError) return { errors: { photo: [e.message] } };
    if (e instanceof PostError) return { message: e.message };
    console.error(e);
    return { message: "Couldn't save the photo. Try again." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("post_bank_items")
    .insert({
      client_id: business.id,
      media_asset_id: mediaId,
      caption: parsed.data.caption,
      wanted_on: parsed.data.wantedOn || null,
      created_by: user.id,
    });
  if (error) return { message: "Couldn't save the photo. Try again." };
  refresh();
  return { ok: true, message: "Sent to our team." };
}

/** Owner removes a photo our team hasn't used yet. */
export async function removePostBankItem(fd: FormData): Promise<void> {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  const { business } = await requireOwnerBusiness();
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin
    .from("post_bank_items")
    .select("id, client_id, status, media:media_assets(id, storage_path)")
    .eq("id", id.data)
    .maybeSingle();
  if (!item || item.client_id !== business.id || item.status !== "submitted") return;
  // Deleting the media row cascades to the post bank item; then remove the file.
  if (item.media) {
    const { count } = await admin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("media_asset_id", item.media.id);
    if (count) {
      await admin.from("post_bank_items").delete().eq("id", item.id);
    } else {
      await admin.from("media_assets").delete().eq("id", item.media.id);
      await admin.storage.from("media").remove([item.media.storage_path]);
    }
  }
  refresh();
}

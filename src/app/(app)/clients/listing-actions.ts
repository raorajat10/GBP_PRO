"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import type { ListingEditState } from "@/components/listing-edit-form";
import { parseListingForm, photoCategorySchema } from "@/lib/gbp/listing-edit";
import { addPostBankPhotoToGoogle, editListing } from "@/lib/gbp/listing-service";
import { canManageClient } from "@/lib/gbp/service";
import { GbpError, type MediaCategory } from "@/lib/gbp/types";

async function allowed(clientId: unknown) {
  const user = await requireUser(["admin", "manager"]);
  const id = z.uuid().safeParse(clientId);
  if (!id.success || !(await canManageClient(id.data, user.role))) return null;
  return { user, clientId: id.data };
}

/** Team edits a client's live Google profile. */
export async function editClientListingAction(
  clientId: string,
  _prev: ListingEditState,
  fd: FormData,
): Promise<ListingEditState> {
  const ok = await allowed(clientId);
  if (!ok) return { message: "You can't change this client." };
  const parsed = parseListingForm(fd);
  if (!parsed.ok) return { errors: parsed.errors, message: "Fix the marked fields." };
  try {
    const { changed } = await editListing({
      clientId: ok.clientId,
      edit: parsed.edit,
      userId: ok.user.id,
      by: "team",
    });
    refresh();
    return changed
      ? { ok: true, message: `Saved to Google: ${changed}. The owner has been told.` }
      : { ok: true, message: "Nothing changed." };
  } catch (e) {
    if (e instanceof GbpError) return { message: e.message };
    console.error(e);
    return { message: "Couldn't reach Google. Try again." };
  }
}

/** Team adds a photo the owner sent (post bank) to the Google profile. */
export async function addPhotoToGoogleAction(fd: FormData): Promise<void> {
  const ok = await allowed(fd.get("clientId"));
  const itemId = z.uuid().safeParse(fd.get("id"));
  const category = photoCategorySchema.safeParse(fd.get("category"));
  if (!ok || !itemId.success || !category.success) return;
  try {
    await addPostBankPhotoToGoogle({
      clientId: ok.clientId,
      itemId: itemId.data,
      category: category.data as MediaCategory,
    });
  } catch (e) {
    console.error("Adding photo to Google failed", e);
  }
  refresh();
}

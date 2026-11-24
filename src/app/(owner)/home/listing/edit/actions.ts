"use server";

import { refresh } from "next/cache";
import type { ListingEditState } from "@/components/listing-edit-form";
import { parseListingForm } from "@/lib/gbp/listing-edit";
import { editListing } from "@/lib/gbp/listing-service";
import { GbpError } from "@/lib/gbp/types";
import { requireOwnerBusiness } from "@/lib/owner/context";

/** Owner edits their own live Google profile (phone, website, description, hours). */
export async function editOwnListingAction(
  _prev: ListingEditState,
  fd: FormData,
): Promise<ListingEditState> {
  const parsed = parseListingForm(fd);
  if (!parsed.ok) return { errors: parsed.errors, message: "Fix the marked fields." };
  const { user, business } = await requireOwnerBusiness();
  try {
    const { changed } = await editListing({
      clientId: business.id,
      edit: parsed.edit,
      userId: user.id,
      by: "owner",
    });
    refresh();
    return changed
      ? { ok: true, message: `Saved to Google: ${changed}.` }
      : { ok: true, message: "Nothing changed." };
  } catch (e) {
    if (e instanceof GbpError) return { message: e.message };
    console.error(e);
    return { message: "Couldn't reach Google. Try again." };
  }
}

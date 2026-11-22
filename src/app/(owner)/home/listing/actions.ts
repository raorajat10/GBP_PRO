"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { attributeLabel } from "@/config/attributes";
import { getOwnerContext, requireOwnerBusiness } from "@/lib/owner/context";
import { attributeChangeLines, CHANGE_AREAS, type OwnerFormState } from "@/lib/owner/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const areas = CHANGE_AREAS.map((a) => a.value) as [string, ...string[]];

const schema = z.object({
  area: z.enum(areas, { error: "Choose what to change." }),
  message: z
    .string()
    .trim()
    .min(3, "Tell us what should change.")
    .max(2000, "Keep it under 2,000 characters."),
});

async function saveRequest(area: string, message: string): Promise<OwnerFormState> {
  const { user, business } = await requireOwnerBusiness();
  const { error } = await createSupabaseAdminClient()
    .from("change_requests")
    .insert({ client_id: business.id, area, message, created_by: user.id });
  if (error) return { message: "Couldn't send your request. Try again." };
  refresh();
  return { ok: true, message: "Sent to our team. We'll update Google and let you know." };
}

/** Owner asks our team to change something on their Google profile. */
export async function requestChange(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const parsed = schema.safeParse({ area: fd.get("area"), message: fd.get("message") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  return saveRequest(parsed.data.area, parsed.data.message);
}

/** Attribute toggles → one change request listing only what differs from Google. */
export async function requestAttributeChange(
  _: OwnerFormState,
  fd: FormData,
): Promise<OwnerFormState> {
  const { snapshot } = await getOwnerContext();
  if (!snapshot) return { message: "Your Google profile isn't linked yet." };
  const wanted = fd.getAll("attr").filter((v): v is string => typeof v === "string");
  const lines = attributeChangeLines(snapshot.profile.attributes, wanted, attributeLabel);
  if (!lines.length) return { message: "Nothing changed. Flip a switch first." };
  return saveRequest("attributes", lines.join("\n"));
}

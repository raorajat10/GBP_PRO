"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import type { OwnerFormState } from "@/lib/owner/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(100, "Keep your name shorter."),
});

/** Owner updates their own name and how we notify them. Only their own profile row. */
export async function saveOwnerSettings(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const user = await requireUser(["client"]);
  const parsed = schema.safeParse({ fullName: fd.get("fullName") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { error } = await createSupabaseAdminClient()
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      notify_whatsapp: fd.get("notifyWhatsapp") === "on",
      notify_email: fd.get("notifyEmail") === "on",
    })
    .eq("id", user.id);
  if (error) {
    console.error(error);
    return { message: "Couldn't save. Try again." };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

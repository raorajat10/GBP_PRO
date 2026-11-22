"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "contacted", "resolved"]),
});

/** Owner marks private feedback as contacted or resolved. */
export async function setFeedbackStatus(fd: FormData): Promise<void> {
  const parsed = schema.safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  const { business } = await requireOwnerBusiness();
  await createSupabaseAdminClient()
    .from("review_feedback")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("client_id", business.id); // only the owner's own feedback
  refresh();
}

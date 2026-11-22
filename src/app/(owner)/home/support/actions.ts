"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/owner/support";

const schema = z.object({
  subject: z.string().trim().min(3, "Add a short subject.").max(150, "Keep the subject short."),
  category: z.enum(TICKET_CATEGORIES.map((c) => c.value) as [string, ...string[]], {
    error: "Choose a category.",
  }),
  priority: z.enum(TICKET_PRIORITIES.map((c) => c.value) as [string, ...string[]]),
  description: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(4000, "Keep it under 4,000 characters."),
});

export async function createTicket(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { user, business } = await requireOwnerBusiness();
  const { error } = await createSupabaseAdminClient()
    .from("support_tickets")
    .insert({ client_id: business.id, created_by: user.id, ...parsed.data });
  if (error) return { message: "Couldn't send your request. Try again." };
  refresh();
  return { ok: true, message: "Sent. Our team usually replies within one working day." };
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface InviteState {
  ok?: boolean;
  message?: string;
}

const inviteSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "manager"]),
});

/** Admin adds a team member. They can then sign in at /login with an email code. */
export async function inviteTeamMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireUser(["admin"]); // re-check: never trust that only admins can see the form

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a name, a valid email and a role." };
  const { email, fullName, role } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role }, // copied into profiles.role by the database trigger
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const exists = error.code === "email_exists" || /already/i.test(error.message);
    return {
      ok: false,
      message: exists
        ? "Someone with this email already has an account."
        : "Couldn't add this person. Try again.",
    };
  }

  refresh();
  return { ok: true, message: `${fullName} can now sign in at /login with ${email}.` };
}

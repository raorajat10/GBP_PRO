"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { parseClientForm, toClientRow } from "@/lib/clients/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface FormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const invalid = (error: z.ZodError): FormState => ({
  message: "Please fix the highlighted fields.",
  fieldErrors: z.flattenError(error).fieldErrors,
});

/** Admin adds a client. */
export async function createClientAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const parsed = parseClientForm(fd);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(toClientRow(parsed.data, null))
    .select("id")
    .single();
  if (error || !data) return { message: "Couldn't save the client. Try again." };

  redirect(`/clients/${data.id}`);
}

/** Admin, or the client's assigned manager, edits a client. Only admins can reassign. */
export async function updateClientAction(
  clientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success) return { message: "Unknown client." };
  const parsed = parseClientForm(fd);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("clients")
    .select("whatsapp_opt_in_at, assigned_manager_id")
    .eq("id", clientId)
    .single();
  if (!existing) return { message: "This client doesn't exist or isn't assigned to you." };

  const row = toClientRow(parsed.data, existing.whatsapp_opt_in_at);
  if (user.role !== "admin") row.assigned_manager_id = existing.assigned_manager_id;

  const { data, error } = await supabase
    .from("clients")
    .update(row)
    .eq("id", clientId)
    .select("id");
  if (error || !data?.length) return { message: "Couldn't save changes. Try again." };

  refresh();
  return { ok: true, message: "Saved." };
}

const ownerSchema = z.object({
  email: z.email("Enter a valid email.").transform((e) => e.trim().toLowerCase()),
  fullName: z.string().trim().min(1, "Enter the owner's name.").max(100),
});

/** Admin gives a business owner a login for the simple client view. */
export async function inviteOwnerAction(
  clientId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireUser(["admin"]);
  if (!z.uuid().safeParse(clientId).success) return { message: "Unknown client." };
  const parsed = ownerSchema.safeParse({ email: fd.get("email"), fullName: fd.get("fullName") });
  if (!parsed.success) return invalid(parsed.error);
  const { email, fullName } = parsed.data;

  const admin = createSupabaseAdminClient();
  let userId: string;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "client" },
    user_metadata: { full_name: fullName },
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // Existing account: allowed only if it's already a client login (e.g. owner of two shops).
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .single();
    if (!profile) return { message: "Couldn't add this owner. Try again." };
    if (profile.role !== "client") {
      return { message: "This email belongs to a team member, so it can't be a client login." };
    }
    userId = profile.id;
  }

  const { error } = await admin
    .from("client_users")
    .upsert({ client_id: clientId, user_id: userId }, { ignoreDuplicates: true });
  if (error) return { message: "Couldn't link this owner to the business. Try again." };

  refresh();
  return { ok: true, message: `${fullName} can now sign in at /login with ${email}.` };
}

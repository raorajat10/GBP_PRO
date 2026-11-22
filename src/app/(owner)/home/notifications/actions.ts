"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function markAllRead(): Promise<void> {
  const { business } = await requireOwnerBusiness();
  await createSupabaseAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", business.id)
    .is("read_at", null);
  refresh();
}

/** Mark one notification read, then open what it points to (in-app paths only). */
export async function openNotification(fd: FormData): Promise<void> {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  const { business } = await requireOwnerBusiness();
  const { data } = await createSupabaseAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("client_id", business.id)
    .select("link")
    .maybeSingle();
  const link = data?.link;
  if (link && link.startsWith("/") && !link.startsWith("//")) redirect(link);
  refresh();
}

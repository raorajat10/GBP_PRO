"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { canManageClient } from "@/lib/gbp/service";
import { notifyClient } from "@/lib/notifications/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Team side of the owner portal: handle change requests, tickets and post-bank photos. */

async function allowed(clientId: unknown) {
  const user = await requireUser(["admin", "manager"]);
  const id = z.uuid().safeParse(clientId);
  if (!id.success || !(await canManageClient(id.data, user.role))) return null;
  return id.data;
}

export async function setChangeRequestStatus(fd: FormData): Promise<void> {
  const clientId = await allowed(fd.get("clientId"));
  const p = z
    .object({ id: z.uuid(), status: z.enum(["open", "done", "declined"]) })
    .safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!clientId || !p.success) return;
  const { data } = await createSupabaseAdminClient()
    .from("change_requests")
    .update({
      status: p.data.status,
      resolved_at: p.data.status === "open" ? null : new Date().toISOString(),
    })
    .eq("id", p.data.id)
    .eq("client_id", clientId)
    .select("id")
    .maybeSingle();
  if (data && p.data.status === "done") {
    await notifyClient({
      clientId,
      kind: "general",
      title: "Your Google profile change is done",
      link: "/home/listing",
    });
  }
  refresh();
}

export async function updateTicket(fd: FormData): Promise<void> {
  const clientId = await allowed(fd.get("clientId"));
  const p = z
    .object({
      id: z.uuid(),
      status: z.enum(["open", "in_progress", "resolved"]),
      reply: z.string().trim().max(4000),
    })
    .safeParse({ id: fd.get("id"), status: fd.get("status"), reply: fd.get("reply") ?? "" });
  if (!clientId || !p.success) return;
  const { data } = await createSupabaseAdminClient()
    .from("support_tickets")
    .update({ status: p.data.status, ...(p.data.reply ? { team_reply: p.data.reply } : {}) })
    .eq("id", p.data.id)
    .eq("client_id", clientId)
    .select("subject")
    .maybeSingle();
  if (data && (p.data.reply || p.data.status === "resolved")) {
    await notifyClient({
      clientId,
      kind: "ticket",
      title: p.data.reply ? `Our team replied: ${data.subject}` : `Resolved: ${data.subject}`,
      body: p.data.reply.slice(0, 200),
      link: "/home/support#tickets",
    });
  }
  refresh();
}

export async function setPostBankStatus(fd: FormData): Promise<void> {
  const clientId = await allowed(fd.get("clientId"));
  const p = z
    .object({ id: z.uuid(), status: z.enum(["submitted", "used", "declined"]) })
    .safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!clientId || !p.success) return;
  await createSupabaseAdminClient()
    .from("post_bank_items")
    .update({ status: p.data.status })
    .eq("id", p.data.id)
    .eq("client_id", clientId);
  refresh();
}

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * In-app notifications for a business (shown on /home/notifications and the bell).
 * Writes use the secret-key client: call only from trusted server code.
 */

export type NotificationKind =
  "review" | "approval" | "score" | "ticket" | "report" | "feedback" | "general";

export async function notifyClient(input: {
  clientId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .insert({
      client_id: input.clientId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: (input.body ?? "").slice(0, 1000),
      link: input.link ?? null,
    });
  // A missed notification must never break the action that caused it.
  if (error) console.error("Couldn't save notification", error.message);
}

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Switch auto reply on or off for a client. Switching on starts the clock: only reviews
 * written from now on are answered, never the old backlog. Changing the star level while
 * it's on keeps the original start time. Caller must have checked the user's access.
 */
export async function setAutoReply(
  clientId: string,
  input: { enabled: boolean; minStars: number },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: current } = await admin
    .from("clients")
    .select("auto_reply_since")
    .eq("id", clientId)
    .single();
  const since = input.enabled ? (current?.auto_reply_since ?? new Date().toISOString()) : null;
  const { error } = await admin
    .from("clients")
    .update({ auto_reply_since: since, auto_reply_min_stars: input.minStars })
    .eq("id", clientId);
  if (error) throw new Error(`Couldn't save auto reply: ${error.message}`);
}

export const MIN_STAR_CHOICES = [5, 4, 3] as const;

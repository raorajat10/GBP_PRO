"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { GbpError } from "@/lib/gbp/types";
import { thankUnansweredGood } from "@/lib/reviews/auto-reply";
import { backlogMessage } from "@/lib/reviews/auto-reply-rules";
import { setAutoReply } from "@/lib/reviews/auto-reply-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  enabled: z.enum(["on", "off"]),
  minStars: z.coerce.number().int().min(3).max(5),
});

/** Owner switches auto reply on/off for the business they are viewing. */
export async function saveOwnerAutoReply(_: OwnerFormState, fd: FormData): Promise<OwnerFormState> {
  const parsed = schema.safeParse({ enabled: fd.get("enabled"), minStars: fd.get("minStars") });
  if (!parsed.success) return { message: "Choose the star level and try again." };
  const { business } = await requireOwnerBusiness();
  try {
    await setAutoReply(business.id, {
      enabled: parsed.data.enabled === "on",
      minStars: parsed.data.minStars,
    });
  } catch (e) {
    console.error(e);
    return { message: "Couldn't save. Try again." };
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.enabled === "on" ? "Auto reply is on." : "Auto reply is off.",
  };
}

/** Owner: thank every old good review of their business that has no reply (up to 50 a press). */
export async function thankOwnBacklog(_: OwnerFormState, _fd: FormData): Promise<OwnerFormState> {
  const { business } = await requireOwnerBusiness();
  const { data: client } = await createSupabaseAdminClient()
    .from("clients")
    .select("auto_reply_min_stars")
    .eq("id", business.id)
    .single();
  try {
    const result = await thankUnansweredGood(business.id, client?.auto_reply_min_stars ?? 4);
    refresh();
    return { ok: result.failed === 0, message: backlogMessage(result) };
  } catch (e) {
    if (e instanceof GbpError) return { message: e.message };
    console.error(e);
    return { message: "Couldn't reach Google. Try again." };
  }
}

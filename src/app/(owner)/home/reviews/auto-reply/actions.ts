"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwnerBusiness } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { setAutoReply } from "@/lib/reviews/auto-reply-settings";

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

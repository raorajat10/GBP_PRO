"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { canManageClient } from "@/lib/gbp/service";
import { setAutoReply } from "@/lib/reviews/auto-reply-settings";

const schema = z.object({
  enabled: z.enum(["on", "off"]),
  minStars: z.coerce.number().int().min(3).max(5),
});

/** Team switches auto reply on/off for a client they manage. */
export async function saveClientAutoReply(
  clientId: string,
  _prev: { ok?: boolean; message?: string },
  fd: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success || !(await canManageClient(clientId, user.role))) {
    return { message: "You can't change this client." };
  }
  const parsed = schema.safeParse({ enabled: fd.get("enabled"), minStars: fd.get("minStars") });
  if (!parsed.success) return { message: "Choose the star level and try again." };
  try {
    await setAutoReply(clientId, {
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

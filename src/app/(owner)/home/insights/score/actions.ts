"use server";

import { refresh } from "next/cache";
import { recordAudit } from "@/lib/audit/service";
import { getOwnerContext } from "@/lib/owner/context";
import type { OwnerFormState } from "@/lib/owner/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MIN_GAP_MS = 10 * 60_000;

/**
 * Owner re-scores their profile from the data we already have (no Google call, no AI).
 * Limited to once every 10 minutes so it can't flood the audit history.
 */
export async function recalculateScore(_: OwnerFormState): Promise<OwnerFormState> {
  const { user, business, location, snapshot } = await getOwnerContext();
  if (!business || !location || !snapshot)
    return { message: "Your Google profile isn't linked yet." };
  const { data: last } = await createSupabaseAdminClient()
    .from("audits")
    .select("created_at")
    .eq("location_id", location.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - Date.parse(last.created_at) < MIN_GAP_MS) {
    return { ok: true, message: "Your score is already up to date." };
  }
  try {
    await recordAudit({
      locationId: location.id,
      clientId: business.id,
      snapshot,
      userId: user.id,
    });
  } catch (e) {
    console.error(e);
    return { message: "Couldn't recalculate right now. Try again later." };
  }
  refresh();
  return { ok: true, message: "Score recalculated." };
}

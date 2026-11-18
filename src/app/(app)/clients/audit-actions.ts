"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AiError } from "@/lib/ai/writer";
import { requireUser } from "@/lib/auth/dal";
import { AuditError, auditLocation, wordAuditWithAi } from "@/lib/audit/service";
import { canManageClient, locationBelongsTo } from "@/lib/gbp/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "./actions";

const failure = (e: unknown): FormState => {
  if (e instanceof AiError || e instanceof AuditError) return { message: e.message };
  console.error(e);
  return { message: "Something went wrong. Please try again." };
};

/** Re-score the stored profile data (no call to Google). */
export async function runAuditAction(
  clientId: string,
  locationId: string,
  _prev: FormState,
  _fd: FormData,
): Promise<FormState> {
  const user = await requireUser(["admin", "manager"]);
  if (
    !(await canManageClient(clientId, user.role)) ||
    !(await locationBelongsTo(locationId, clientId))
  ) {
    return { message: "You don't have access to this profile." };
  }
  try {
    await auditLocation(locationId, user.id);
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { ok: true, message: "Audit updated." };
}

/** Ask Claude to word the fixes for this client's audit. */
export async function wordAuditAction(
  clientId: string,
  auditId: string,
  _prev: FormState,
  _fd: FormData,
): Promise<FormState> {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(auditId).success || !(await canManageClient(clientId, user.role))) {
    return { message: "You don't have access to this client." };
  }
  const { data: audit } = await createSupabaseAdminClient()
    .from("audits")
    .select("client_id")
    .eq("id", auditId)
    .maybeSingle();
  if (audit?.client_id !== clientId) return { message: "This audit isn't for this client." };

  try {
    const { worded } = await wordAuditWithAi(auditId);
    refresh();
    return {
      ok: true,
      message: worded ? `AI wrote ${worded} fix${worded === 1 ? "" : "es"}.` : "Nothing to fix.",
    };
  } catch (e) {
    return failure(e);
  }
}

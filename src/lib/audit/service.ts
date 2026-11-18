import "server-only";
import type { AuditCheckKey } from "@/config/audit";
import { getAiWriter } from "@/lib/ai/claude";
import { AiError, type AuditFixRequest } from "@/lib/ai/writer";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditSnapshot, type AuditStatus } from "./checks";

/**
 * Saving and reading audits. Writes use the secret-key client, so callers must check
 * the user's permission first (same rule as src/lib/gbp/service.ts).
 */

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditError";
  }
}

/**
 * Score a snapshot and save it as a new audit. AI-worded fixes from the previous audit are
 * kept for checks whose findings haven't changed, so a sync doesn't throw away paid-for text.
 */
export async function recordAudit(input: {
  locationId: string;
  clientId: string;
  snapshot: LocationSnapshot;
  userId?: string | null;
}): Promise<{ auditId: string; score: number }> {
  const admin = createSupabaseAdminClient();
  const result = auditSnapshot(input.snapshot);

  const { data: prev } = await admin
    .from("audits")
    .select(
      "id, suggested_description, ai_model, ai_worded_at, audit_items(check_key, status, facts, fix_text, fix_source)",
    )
    .eq("location_id", input.locationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reuse = new Map(
    (prev?.audit_items ?? [])
      .filter((i) => i.fix_source === "ai")
      .map((i) => [`${i.check_key}|${i.status}|${i.facts}`, i.fix_text]),
  );
  const descriptionItem = result.items.find((i) => i.key === "description")!;
  const keepDescription =
    descriptionItem.status !== "pass" &&
    reuse.has(`description|${descriptionItem.status}|${descriptionItem.facts}`);
  const items = result.items.map((i) => {
    const aiText = i.status === "pass" ? undefined : reuse.get(`${i.key}|${i.status}|${i.facts}`);
    return {
      ...i,
      fixText: aiText ?? i.fix,
      fixSource: aiText ? ("ai" as const) : ("rule" as const),
    };
  });
  const anyAi = items.some((i) => i.fixSource === "ai");

  const { data: audit, error } = await admin
    .from("audits")
    .insert({
      location_id: input.locationId,
      client_id: input.clientId,
      score: result.score,
      snapshot_synced_at: input.snapshot.syncedAt,
      created_by: input.userId ?? null,
      suggested_description: keepDescription ? (prev?.suggested_description ?? null) : null,
      ai_model: anyAi ? (prev?.ai_model ?? null) : null,
      ai_worded_at: anyAi ? (prev?.ai_worded_at ?? null) : null,
    })
    .select("id")
    .single();
  if (error || !audit) throw new AuditError("Couldn't save the audit.");

  const { error: itemsError } = await admin.from("audit_items").insert(
    items.map((i) => ({
      audit_id: audit.id,
      check_key: i.key,
      status: i.status,
      points: i.points,
      points_max: i.maxPoints,
      rank: i.rank,
      title: i.title,
      facts: i.facts,
      fix_text: i.fixText,
      fix_source: i.fixSource,
    })),
  );
  if (itemsError) {
    await admin.from("audits").delete().eq("id", audit.id);
    throw new AuditError("Couldn't save the audit.");
  }

  await admin
    .from("locations")
    .update({ audit_score: result.score, audited_at: new Date().toISOString() })
    .eq("id", input.locationId);
  return { auditId: audit.id, score: result.score };
}

/** Re-score the stored snapshot of a location (no call to Google). */
export async function auditLocation(locationId: string, userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select("id, client_id, snapshot")
    .eq("id", locationId)
    .maybeSingle();
  if (!loc) throw new AuditError("Linked profile not found.");
  await recordAudit({
    locationId: loc.id,
    clientId: loc.client_id,
    snapshot: loc.snapshot as unknown as LocationSnapshot,
    userId,
  });
}

export const aiWritingEnabled = () => getAiWriter() !== null;

/** Ask Claude to word the fixes of one audit, then save the text. */
export async function wordAuditWithAi(auditId: string): Promise<{ worded: number }> {
  const writer = getAiWriter();
  if (!writer)
    throw new AiError("AI writing isn't switched on (no ANTHROPIC_API_KEY).", "not_configured");

  const admin = createSupabaseAdminClient();
  const { data: audit } = await admin
    .from("audits")
    .select(
      "id, location:locations(snapshot), client:clients(brand_notes), audit_items(id, check_key, status, points_lost, title, facts, fix_text, rank)",
    )
    .eq("id", auditId)
    .maybeSingle();
  if (!audit?.location) throw new AuditError("Audit not found.");

  const s = audit.location.snapshot as unknown as LocationSnapshot;
  const p = s.profile;
  const open = audit.audit_items.filter((i) => i.status !== "pass").sort((a, b) => a.rank - b.rank);
  if (!open.length) return { worded: 0 };

  const request: AuditFixRequest = {
    business: {
      title: p.title,
      primaryCategory: p.primaryCategory?.displayName ?? null,
      additionalCategories: p.additionalCategories.map((c) => c.displayName),
      area: p.address?.addressLines.at(-1) ?? null,
      city: p.address?.locality ?? null,
      services: p.services,
      attributes: p.attributes,
      description: p.description,
      industryNote: audit.client?.brand_notes ?? null,
    },
    items: open.map((i) => ({
      key: i.check_key as AuditCheckKey,
      title: i.title,
      status: i.status as Exclude<AuditStatus, "pass">,
      pointsLost: i.points_lost ?? 0,
      facts: i.facts,
      ruleFix: i.fix_text,
    })),
  };

  const result = await writer.writeAuditFixes(request);
  const byKey = new Map(open.map((i) => [i.check_key, i.id]));
  for (const fix of result.fixes) {
    const id = byKey.get(fix.key);
    if (!id) continue;
    const { error } = await admin
      .from("audit_items")
      .update({ fix_text: fix.text, fix_source: "ai" })
      .eq("id", id);
    if (error) throw new AuditError("Couldn't save the AI wording.");
  }
  await admin
    .from("audits")
    .update({
      ai_model: result.model,
      ai_worded_at: new Date().toISOString(),
      suggested_description: result.suggestedDescription,
    })
    .eq("id", auditId);
  return { worded: result.fixes.length };
}

export interface AuditView {
  id: string;
  score: number;
  createdAt: string;
  snapshotSyncedAt: string;
  aiModel: string | null;
  aiWordedAt: string | null;
  suggestedDescription: string | null;
  items: {
    key: string;
    status: AuditStatus;
    points: number;
    pointsMax: number;
    pointsLost: number;
    rank: number;
    title: string;
    facts: string;
    fixText: string;
    fixSource: "rule" | "ai";
  }[];
  previousScore: number | null;
}

/** Latest audit for a location, read as the signed-in user (row-level security applies). */
export async function getLatestAudit(locationId: string): Promise<AuditView | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audits")
    .select(
      "id, score, created_at, snapshot_synced_at, ai_model, ai_worded_at, suggested_description, audit_items(check_key, status, points, points_max, points_lost, rank, title, facts, fix_text, fix_source)",
    )
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(2);
  const [latest, previous] = data ?? [];
  if (!latest) return null;
  return {
    id: latest.id,
    score: latest.score,
    createdAt: latest.created_at,
    snapshotSyncedAt: latest.snapshot_synced_at,
    aiModel: latest.ai_model,
    aiWordedAt: latest.ai_worded_at,
    suggestedDescription: latest.suggested_description,
    previousScore: previous?.score ?? null,
    items: latest.audit_items
      .map((i) => ({
        key: i.check_key,
        status: i.status as AuditStatus,
        points: i.points,
        pointsMax: i.points_max,
        pointsLost: i.points_lost ?? i.points_max - i.points,
        rank: i.rank,
        title: i.title,
        facts: i.facts,
        fixText: i.fix_text,
        fixSource: i.fix_source as "rule" | "ai",
      }))
      .sort((a, b) => a.rank - b.rank),
  };
}

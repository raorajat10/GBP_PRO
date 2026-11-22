import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  biasRadiusMeters,
  gridPoints,
  MAX_RANK,
  monthStartIst,
  summarizeScan,
  type GridSize,
  type LatLng,
  type PlaceResult,
} from "./grid";
import { getRankProvider, RankError, sampleRank } from "./provider";

/**
 * Tracked keywords and grid scans. Writes use the secret-key client, so callers must check
 * the user may act for this client first (owner of it, or its team).
 */

export const MAX_KEYWORDS = 5;
const SEARCH_CONCURRENCY = 5;

/** The ID we look for in results: the real Google place ID, or a stand-in for sample data. */
export const selfPlaceId = (loc: { id: string; place_id: string | null }) =>
  loc.place_id ?? `SELF_${loc.id}`;

function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function addKeyword(input: {
  clientId: string;
  keyword: string;
  gridSize: GridSize;
  radiusKm: number;
  userId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: loc } = await admin
    .from("locations")
    .select("id")
    .eq("client_id", input.clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!loc) throw new RankError("Link the Google profile first.", "not_found");
  const { count } = await admin
    .from("rank_keywords")
    .select("id", { count: "exact", head: true })
    .eq("location_id", loc.id);
  if ((count ?? 0) >= MAX_KEYWORDS) {
    throw new RankError(`You can track up to ${MAX_KEYWORDS} keywords. Remove one first.`, "quota");
  }
  const { error } = await admin.from("rank_keywords").insert({
    client_id: input.clientId,
    location_id: loc.id,
    keyword: input.keyword,
    grid_size: input.gridSize,
    radius_km: input.radiusKm,
    created_by: input.userId,
  });
  if (error?.code === "23505")
    throw new RankError("You're already tracking that keyword.", "quota");
  if (error) throw new RankError("Couldn't save the keyword. Try again.");
}

export async function removeKeyword(clientId: string, keywordId: string): Promise<void> {
  await createSupabaseAdminClient()
    .from("rank_keywords")
    .delete()
    .eq("id", keywordId)
    .eq("client_id", clientId);
}

/** Grid points used this calendar month (India time) and the client's monthly allowance. */
export async function scanAllowance(clientId: string, now = new Date()) {
  const admin = createSupabaseAdminClient();
  const [{ data: client }, { data: scans }] = await Promise.all([
    admin.from("clients").select("rank_points_per_month").eq("id", clientId).single(),
    admin
      .from("rank_scans")
      .select("points")
      .eq("client_id", clientId)
      .neq("status", "failed")
      .gte("created_at", monthStartIst(now)),
  ]);
  const used = (scans ?? []).reduce((t, s) => t + s.points, 0);
  const limit = client?.rank_points_per_month ?? 0;
  return { used, limit, left: Math.max(0, limit - used) };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Search the keyword from every grid point and save where the business ranks. */
export async function runScan(input: {
  clientId: string;
  keywordId: string;
  userId: string;
}): Promise<{ scanId: string }> {
  const admin = createSupabaseAdminClient();
  const { data: kw } = await admin
    .from("rank_keywords")
    .select("id, client_id, keyword, grid_size, radius_km, location:locations(id, title, place_id)")
    .eq("id", input.keywordId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!kw?.location) throw new RankError("Keyword not found.", "not_found");
  const loc = kw.location;
  const size = kw.grid_size as GridSize;
  const radiusKm = Number(kw.radius_km);
  const points = size * size;

  const { data: running } = await admin
    .from("rank_scans")
    .select("id")
    .eq("keyword_id", kw.id)
    .eq("status", "running")
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(1);
  if (running?.length) throw new RankError("A scan for this keyword is already running.", "quota");

  const allowance = await scanAllowance(input.clientId);
  if (allowance.left < points) {
    throw new RankError(
      `This scan needs ${points} grid points but only ${allowance.left} are left this month.`,
      "quota",
    );
  }

  const provider = getRankProvider();
  const center = await provider.locate({ placeId: loc.place_id, title: loc.title });
  const { data: scan, error: scanErr } = await admin
    .from("rank_scans")
    .insert({
      client_id: input.clientId,
      location_id: loc.id,
      keyword_id: kw.id,
      keyword: kw.keyword,
      provider: provider.kind,
      grid_size: size,
      radius_km: radiusKm,
      center_lat: center.lat,
      center_lng: center.lng,
      points,
      requested_by: input.userId,
    })
    .select("id")
    .single();
  if (scanErr || !scan) throw new RankError("Couldn't start the scan. Try again.");

  const me = selfPlaceId(loc);
  const bias = biasRadiusMeters(size, radiusKm);
  try {
    const grid = gridPoints(center, size, radiusKm);
    const results = await mapLimit(grid, SEARCH_CONCURRENCY, async (p) => {
      let list: PlaceResult[] = await provider.search({
        keyword: kw.keyword,
        at: p,
        biasRadiusM: bias,
      });
      if (provider.kind === "mock") {
        const r = sampleRank(distanceKm(center, p), radiusKm, `${kw.keyword}:${p.row}:${p.col}`);
        list = list.filter((x) => x.placeId !== me);
        if (r != null) list.splice(r - 1, 0, { placeId: me, name: loc.title, address: null });
      }
      list = list.slice(0, MAX_RANK);
      const idx = list.findIndex((x) => x.placeId === me);
      return { ...p, rank: idx === -1 ? null : idx + 1, results: list };
    });

    const { error: pErr } = await admin.from("rank_scan_points").insert(
      results.map((p) => ({
        scan_id: scan.id,
        client_id: input.clientId,
        row_idx: p.row,
        col_idx: p.col,
        lat: p.lat,
        lng: p.lng,
        rank: p.rank,
        results: p.results as unknown as NonNullable<Json>,
      })),
    );
    if (pErr) throw new RankError("Couldn't save the scan results.");

    const s = summarizeScan(results.map((p) => p.rank));
    await admin
      .from("rank_scans")
      .update({
        status: "done",
        found_points: s.foundPoints,
        top3_points: s.top3Points,
        avg_rank: s.avgRank,
        arp: s.arp,
        best_rank: s.bestRank,
        worst_rank: s.worstRank,
        finished_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    return { scanId: scan.id };
  } catch (e) {
    await admin
      .from("rank_scans")
      .update({
        status: "failed",
        error: e instanceof RankError ? e.message : "Unexpected error",
        finished_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    throw e instanceof RankError ? e : new RankError("The scan failed. Try again later.");
  }
}

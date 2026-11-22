import Link from "next/link";
import { competitorsFrom, type PlaceResult } from "@/lib/rank/grid";
import { selfPlaceId } from "@/lib/rank/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Empty, Panel } from "./ui";

/** Home-page summary: you and the three most visible competitors from the latest scans. */
export async function TopCompetitors({
  locationId,
  businessName,
}: {
  locationId: string;
  businessName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const [{ data: loc }, { data: scans }] = await Promise.all([
    supabase.from("locations").select("id, place_id").eq("id", locationId).single(),
    supabase
      .from("rank_scans")
      .select("id, keyword, keyword_id, created_at")
      .eq("location_id", locationId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  // Latest scan per keyword (scans are newest first).
  const seen = new Set<string>();
  const perKeyword = (scans ?? []).filter((s) =>
    seen.has(s.keyword_id) ? false : (seen.add(s.keyword_id), true),
  );

  const link = (
    <Link
      href="/home/insights/competitors"
      className="text-primary text-sm font-medium hover:underline"
    >
      All competitors
    </Link>
  );
  if (!perKeyword.length) {
    return (
      <Panel title="Top competitors" description="From your grid scans">
        <Empty
          action={
            <Link
              href="/home/insights/grid"
              className="text-primary text-sm font-semibold hover:underline"
            >
              Set up grid ranking
            </Link>
          }
        >
          See who outranks you nearby. Track a keyword and run your first scan.
        </Empty>
      </Panel>
    );
  }
  const { data: pts } = await supabase
    .from("rank_scan_points")
    .select("scan_id, rank, results")
    .in(
      "scan_id",
      perKeyword.map((s) => s.id),
    );
  const me = selfPlaceId({ id: locationId, place_id: loc?.place_id ?? null });
  const { rows } = competitorsFrom(
    perKeyword.map((s) => ({
      keyword: s.keyword,
      points: (pts ?? [])
        .filter((p) => p.scan_id === s.id)
        .map((p) => ({ rank: p.rank, results: p.results as unknown as PlaceResult[] })),
    })),
    me,
  );
  const you = rows.find((r) => r.isYou);
  const top = rows.filter((r) => !r.isYou).slice(0, 3);

  return (
    <Panel
      title="Top competitors"
      description={`From ${perKeyword.length === 1 ? "1 keyword" : `${perKeyword.length} keywords`} you track`}
      actions={link}
    >
      <ol className="flex flex-col gap-2">
        <li className="border-primary bg-primary-soft/60 flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <span className="font-semibold">{businessName} (you)</span>
          <span className="text-sm tabular-nums">
            {you ? `${Math.round(you.visibility * 100)}% visible` : "Not in top 20"}
          </span>
        </li>
        {top.map((r, i) => (
          <li
            key={r.placeId}
            className="border-line flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
          >
            <span className="min-w-0 truncate">
              <span className="text-ink-muted mr-2 tabular-nums">#{i + 1}</span>
              {r.name}
            </span>
            <span className="text-ink-muted shrink-0 text-sm tabular-nums">
              {Math.round(r.visibility * 100)}% visible
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

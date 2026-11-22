import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { getOwnerContext } from "@/lib/owner/context";
import type { PlaceResult } from "@/lib/rank/grid";
import { scanAllowance, selfPlaceId } from "@/lib/rank/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { Empty, Figure, fmtDateTime, NoBusiness, NoProfile, PageHeader, Panel, Pill } from "@/components/owner/ui";
import { removeKeywordAction } from "./actions";
import { AddKeywordForm, ScanNowButton } from "./grid-forms";
import { GridView } from "./grid-view";

export const metadata: Metadata = { title: "Grid ranking" };

const uuid = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null);

export default function GridPage({ searchParams }: PageProps<"/home/insights/grid">) {
  return (
    <>
      <PageHeader
        title="Grid ranking"
        description="Where you show up on Google Maps when people search from different spots around you. Each dot is one search location."
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        {searchParams.then((sp) => (
          <Grid keywordId={uuid(sp.k)} scanId={uuid(sp.scan)} />
        ))}
      </Suspense>
    </>
  );
}

async function Grid({ keywordId, scanId }: { keywordId: string | null; scanId: string | null }) {
  const { business, location } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Grid ranking" />;
  const supabase = await createSupabaseServerClient();
  const [{ data: keywords }, allowance, { data: loc }] = await Promise.all([
    supabase
      .from("rank_keywords")
      .select("id, keyword, grid_size, radius_km")
      .eq("location_id", location.id)
      .order("created_at"),
    scanAllowance(business.id),
    supabase.from("locations").select("id, place_id").eq("id", location.id).single(),
  ]);
  const kws = keywords ?? [];
  const kw = kws.find((k) => k.id === keywordId) ?? kws[0] ?? null;

  const meter = (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>Grid points used this month</span>
        <span className="font-semibold tabular-nums">
          {allowance.used} / {allowance.limit}
        </span>
      </div>
      <div className="bg-paper h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${allowance.limit ? Math.min(100, (allowance.used / allowance.limit) * 100) : 100}%` }}
        />
      </div>
    </div>
  );

  if (!kw) {
    return (
      <>
        <Panel title="Track a keyword" description="Up to 5 searches your customers make, like “solar company in jaipur” or “inverter repair near me”.">
          <AddKeywordForm />
        </Panel>
        <Panel>{meter}</Panel>
      </>
    );
  }

  const { data: scans } = await supabase
    .from("rank_scans")
    .select("id, status, provider, grid_size, radius_km, points, found_points, top3_points, avg_rank, arp, best_rank, worst_rank, error, created_at")
    .eq("keyword_id", kw.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const history = scans ?? [];
  const scan = history.find((s) => s.id === scanId) ?? history.find((s) => s.status === "done") ?? null;
  const { data: pts } = scan
    ? await supabase.from("rank_scan_points").select("row_idx, col_idx, rank, results").eq("scan_id", scan.id)
    : { data: null };
  const points = (pts ?? []).map((p) => ({
    row: p.row_idx,
    col: p.col_idx,
    rank: p.rank,
    results: p.results as unknown as PlaceResult[],
  }));
  const lastFailed = history[0]?.status === "failed" ? history[0] : null;

  return (
    <>
      <nav aria-label="Keywords" className="flex flex-wrap items-center gap-2 text-sm">
        {kws.map((k) => (
          <Link
            key={k.id}
            href={`/home/insights/grid?k=${k.id}`}
            aria-current={k.id === kw.id ? "page" : undefined}
            className={
              k.id === kw.id
                ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
                : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
            }
          >
            {k.keyword}
          </Link>
        ))}
      </nav>

      <Panel
        title={`“${kw.keyword}”`}
        description={`${kw.grid_size} × ${kw.grid_size} grid, up to ${Number(kw.radius_km)} km from your business`}
        actions={
          <form action={removeKeywordAction}>
            <input type="hidden" name="keywordId" value={kw.id} />
            <button type="submit" className="text-danger text-sm hover:underline">
              Stop tracking
            </button>
          </form>
        }
      >
        <ScanNowButton keywordId={kw.id} points={kw.grid_size * kw.grid_size} left={allowance.left} />
        {lastFailed && (
          <p role="alert" className="text-danger text-sm">
            The last scan failed: {lastFailed.error ?? "unknown error"}
          </p>
        )}
        {meter}
      </Panel>

      {scan ? (
        <>
          <section aria-label="Scan results" className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Figure
              label="Average position"
              value={scan.avg_rank != null ? Number(scan.avg_rank).toFixed(1) : "–"}
              note="Where you appear"
            />
            <Figure
              label="Visibility"
              value={`${Math.round(((scan.found_points ?? 0) / scan.points) * 100)}%`}
              note={`Top 20 at ${scan.found_points} of ${scan.points} points`}
            />
            <Figure
              label="In the map pack"
              value={`${scan.top3_points ?? 0} / ${scan.points}`}
              note="Points where you're top 3"
              tone={(scan.top3_points ?? 0) > 0 ? "success" : "accent"}
            />
            <Figure
              label="Best / worst"
              value={scan.best_rank ? `#${scan.best_rank} / #${scan.worst_rank}` : "–"}
              note={`ARP ${Number(scan.arp ?? 21).toFixed(1)} (not found = 21)`}
            />
          </section>

          <Panel
            title="Your grid"
            description={`Scanned ${fmtDateTime(scan.created_at)}. Tap a dot to see who ranks there.`}
            actions={scan.provider === "mock" ? <Pill tone="accent">Sample data</Pill> : undefined}
          >
            <GridView
              size={scan.grid_size}
              points={points}
              youPlaceId={selfPlaceId({ id: location.id, place_id: loc?.place_id ?? null })}
              businessName={business.name}
            />
          </Panel>
        </>
      ) : (
        <Panel>
          <Empty>No scan yet for this keyword. Press Scan now to see your grid.</Empty>
        </Panel>
      )}

      {history.length > 0 && (
        <Panel title="Scan history">
          <ul className="divide-line flex flex-col divide-y text-sm">
            {history.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/home/insights/grid?k=${kw.id}&scan=${s.id}`}
                  aria-current={s.id === scan?.id ? "true" : undefined}
                  className="hover:text-primary flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className={s.id === scan?.id ? "font-semibold" : ""}>{fmtDateTime(s.created_at)}</span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {s.status === "done" ? (
                      <>
                        <span>Avg {s.avg_rank != null ? Number(s.avg_rank).toFixed(1) : "–"}</span>
                        <span className="text-ink-muted">
                          {Math.round(((s.found_points ?? 0) / s.points) * 100)}% visible
                        </span>
                      </>
                    ) : (
                      <Pill tone={s.status === "failed" ? "danger" : "accent"}>
                        {s.status === "failed" ? "Failed" : "Running"}
                      </Pill>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {kws.length < 5 && (
        <Panel title="Track another keyword">
          <AddKeywordForm />
        </Panel>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { getOwnerContext } from "@/lib/owner/context";
import { competitorsFrom, type PlaceResult } from "@/lib/rank/grid";
import { selfPlaceId } from "@/lib/rank/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import {
  Empty,
  fmtDate,
  NoBusiness,
  NoProfile,
  nf,
  PageHeader,
  Panel,
  Pill,
} from "@/components/owner/ui";

export const metadata: Metadata = { title: "Competitors" };

export default function CompetitorsPage({ searchParams }: PageProps<"/home/insights/competitors">) {
  return (
    <>
      <PageHeader
        title="Competitors"
        description="The businesses that show up most often when people search near you, taken from your latest grid scans."
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        {searchParams.then((sp) => (
          <Competitors
            keywordId={typeof sp.k === "string" && z.uuid().safeParse(sp.k).success ? sp.k : null}
          />
        ))}
      </Suspense>
    </>
  );
}

async function Competitors({ keywordId }: { keywordId: string | null }) {
  const { business, location } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Your competitors" />;
  const supabase = await createSupabaseServerClient();
  const [{ data: keywords }, { data: loc }] = await Promise.all([
    supabase
      .from("rank_keywords")
      .select("id, keyword")
      .eq("location_id", location.id)
      .order("created_at"),
    supabase.from("locations").select("id, place_id").eq("id", location.id).single(),
  ]);
  const kws = (keywords ?? []).filter((k) => !keywordId || k.id === keywordId);

  // Latest finished scan per keyword.
  const latest = await Promise.all(
    kws.map(async (k) => {
      const { data } = await supabase
        .from("rank_scans")
        .select("id, keyword, provider, created_at")
        .eq("keyword_id", k.id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }),
  );
  const scans = latest.filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (!scans.length) {
    return (
      <Panel>
        <Empty
          action={
            <Link
              href="/home/insights/grid"
              className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold"
            >
              Go to grid ranking
            </Link>
          }
        >
          Competitors appear after your first grid scan. Track a keyword and scan it to see who
          you&apos;re up against.
        </Empty>
      </Panel>
    );
  }

  const { data: pts } = await supabase
    .from("rank_scan_points")
    .select("scan_id, rank, results")
    .in(
      "scan_id",
      scans.map((s) => s.id),
    );
  const me = selfPlaceId({ id: location.id, place_id: loc?.place_id ?? null });
  const { rows, pointsScanned } = competitorsFrom(
    scans.map((s) => ({
      keyword: s.keyword,
      points: (pts ?? [])
        .filter((p) => p.scan_id === s.id)
        .map((p) => ({ rank: p.rank, results: p.results as unknown as PlaceResult[] })),
    })),
    me,
  );
  const you = rows.find((r) => r.isYou);
  const others = rows.filter((r) => !r.isYou).slice(0, 20);
  const ahead = others.filter((r) => you == null || r.visibility > you.visibility).length;
  const sample = scans.some((s) => s.provider === "mock");

  return (
    <>
      <nav aria-label="Keywords" className="flex flex-wrap gap-2 text-sm">
        {[{ id: null, keyword: "All keywords" }, ...(keywords ?? [])].map((k) => {
          const on = (k.id ?? null) === keywordId;
          return (
            <Link
              key={k.id ?? "all"}
              href={k.id ? `/home/insights/competitors?k=${k.id}` : "/home/insights/competitors"}
              aria-current={on ? "page" : undefined}
              className={
                on
                  ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
                  : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
              }
            >
              {k.keyword}
            </Link>
          );
        })}
      </nav>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {you ? (
              ahead === 0 ? (
                <span className="font-semibold">
                  You&apos;re the most visible business in these searches.
                </span>
              ) : (
                <>
                  <span className="font-semibold">
                    {ahead === 1 ? "1 business shows up" : `${ahead} businesses show up`} more often
                    than you.
                  </span>{" "}
                  <span className="text-ink-muted">
                    You appear at {Math.round(you.visibility * 100)}% of points.
                  </span>
                </>
              )
            ) : (
              <span className="font-semibold">
                You didn&apos;t appear in the top 20 at any point.
              </span>
            )}
          </p>
          <p className="text-ink-muted text-sm">
            {nf.format(pointsScanned)} points from {scans.length}{" "}
            {scans.length === 1 ? "scan" : "scans"}, latest{" "}
            {fmtDate(
              scans
                .map((s) => s.created_at)
                .sort()
                .at(-1)!,
            )}
            {sample && (
              <>
                {" "}
                <Pill tone="accent">Sample data</Pill>
              </>
            )}
          </p>
        </div>
      </Panel>

      <Panel
        title="Who you're up against"
        description="Visibility: share of grid points where they appear in the top 20."
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Business</th>
                <th className="py-2 pr-3 text-right font-medium">Visibility</th>
                <th className="py-2 pr-3 text-right font-medium">Avg position</th>
                <th className="py-2 pr-3 text-right font-medium">Map pack</th>
                <th className="py-2 text-right font-medium">Ahead of you</th>
              </tr>
            </thead>
            <tbody>
              {you && (
                <Row
                  n="You"
                  name={business.name}
                  address={null}
                  visibility={you.visibility}
                  avgRank={you.avgRank}
                  top3={you.top3}
                  ahead={null}
                  highlight
                />
              )}
              {others.map((r, i) => (
                <Row
                  key={r.placeId}
                  n={String(i + 1)}
                  name={r.name}
                  address={r.address}
                  visibility={r.visibility}
                  avgRank={r.avgRank}
                  top3={r.top3}
                  ahead={r.aheadOfYou}
                  keywords={keywordId ? undefined : r.keywords}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Row(props: {
  n: string;
  name: string;
  address: string | null;
  visibility: number;
  avgRank: number;
  top3: number;
  ahead: number | null;
  keywords?: string[];
  highlight?: boolean;
}) {
  const pct = Math.round(props.visibility * 100);
  return (
    <tr
      className={`border-line border-t ${props.highlight ? "bg-primary-soft/60 font-semibold" : ""}`}
    >
      <td className="py-2.5 pr-3 tabular-nums">{props.n}</td>
      <td className="py-2.5 pr-3">
        <span className="block">{props.name}</span>
        {props.address && (
          <span className="text-ink-muted block text-xs font-normal">{props.address}</span>
        )}
        {props.keywords && props.keywords.length > 1 && (
          <span className="text-ink-muted block text-xs font-normal">
            {props.keywords.join(", ")}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          <span
            className="bg-paper hidden h-1.5 w-16 overflow-hidden rounded-full sm:block"
            aria-hidden="true"
          >
            <span className="bg-series-1 block h-full rounded-full" style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular-nums">{pct}%</span>
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{props.avgRank.toFixed(1)}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{props.top3}</td>
      <td className="py-2.5 text-right tabular-nums">{props.ahead == null ? "–" : props.ahead}</td>
    </tr>
  );
}

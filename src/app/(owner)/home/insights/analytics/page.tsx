import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  change,
  parseRange,
  RANGES,
  splitRange,
  totalsOf,
  type MetricDay,
  type RangeDays,
} from "@/lib/owner/analytics";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { LineChart } from "@/components/owner/line-chart";
import { Empty, NoBusiness, NoProfile, nf, PageHeader, Panel } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/home/insights/analytics">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Analytics" />
          <ListSkeleton rows={4} />
        </>
      }
    >
      {searchParams.then((sp) => (
        <Analytics range={parseRange(sp.range)} />
      ))}
    </Suspense>
  );
}

async function Analytics({ range }: { range: RangeDays }) {
  const header = (
    <PageHeader
      title="Analytics"
      description="How people found your Google profile and what they did next."
      actions={
        <nav
          aria-label="Date range"
          className="border-line bg-surface flex rounded-lg border p-0.5 text-sm"
        >
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/home/insights/analytics?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={
                r === range
                  ? "bg-primary text-primary-ink rounded-md px-3 py-1 font-semibold"
                  : "text-ink-muted hover:text-ink rounded-md px-3 py-1"
              }
            >
              {r} days
            </Link>
          ))}
        </nav>
      }
    />
  );
  const { business, location } = await getOwnerContext();
  if (!business)
    return (
      <>
        {header}
        <NoBusiness />
      </>
    );
  if (!location)
    return (
      <>
        {header}
        <NoProfile what="Your analytics" />
      </>
    );

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("location_metrics_daily")
    .select("day, impressions_search, impressions_maps, calls, direction_requests, website_clicks")
    .eq("location_id", location.id)
    .order("day")
    .limit(400);
  const all = (data ?? []) as MetricDay[];
  if (!all.length) {
    return (
      <>
        {header}
        <Panel>
          <Empty>
            Daily numbers appear after our next update of your Google profile. Google shares them
            with a delay of a few days.
          </Empty>
        </Panel>
      </>
    );
  }

  const { current, previous, dates } = splitRange(all, range);
  const now = totalsOf(current);
  const before = previous ? totalsOf(previous) : null;
  const actionsMax = Math.max(now.calls, now.directions, now.website, 1);

  return (
    <>
      {header}
      <p className="text-ink-muted -mt-3 text-sm">
        {dates.length < range
          ? `We have ${dates.length} days of data so far.`
          : previous
            ? `Compared with the ${range} days before.`
            : "Comparisons appear once we have a longer history."}
      </p>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="Profile views"
          value={nf.format(now.views)}
          delta={change(now.views, before?.views)}
          note={`Search ${nf.format(now.search)}, Maps ${nf.format(now.maps)}`}
        />
        <Tile label="Calls" value={nf.format(now.calls)} delta={change(now.calls, before?.calls)} />
        <Tile
          label="Direction requests"
          value={nf.format(now.directions)}
          delta={change(now.directions, before?.directions)}
        />
        <Tile
          label="Engagement"
          value={now.engagement == null ? "–" : `${(now.engagement * 100).toFixed(1)}%`}
          note="Calls, directions and website clicks per 100 views"
        />
      </section>

      <Panel
        title="Profile views"
        description="People who saw your profile, by where they found it"
      >
        <LineChart
          label={`Daily profile views from Google Search and Google Maps, last ${dates.length} days`}
          dates={dates}
          series={[
            {
              name: "Search",
              color: "var(--series-1)",
              values: current.map((d) => d.impressions_search),
            },
            {
              name: "Maps",
              color: "var(--series-2)",
              values: current.map((d) => d.impressions_maps),
            },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Customer actions"
          description="Calls, direction requests and website clicks per day"
        >
          <LineChart
            label={`Daily customer actions, last ${dates.length} days`}
            dates={dates}
            series={[
              {
                name: "Actions",
                color: "var(--series-1)",
                values: current.map((d) => d.calls + d.direction_requests + d.website_clicks),
              },
            ]}
          />
        </Panel>
        <Panel title="What customers did" description={`Total for the last ${dates.length} days`}>
          <ul className="flex flex-col gap-4">
            {[
              { label: "Called you", value: now.calls },
              { label: "Asked for directions", value: now.directions },
              { label: "Visited your website", value: now.website },
            ].map((r) => (
              <li key={r.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="font-bold tabular-nums">{nf.format(r.value)}</span>
                </div>
                <div className="bg-paper mt-1.5 h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-series-1 h-full rounded-full"
                    style={{ width: `${(r.value / actionsMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  delta,
  note,
}: {
  label: string;
  value: string;
  delta?: number | null;
  note?: string;
}) {
  return (
    <div className="border-line bg-surface flex flex-col gap-1 rounded-2xl border px-5 py-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className="text-3xl leading-tight font-bold tabular-nums">{value}</p>
      {delta != null && (
        <p
          className={`text-xs font-semibold ${delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-ink-muted"}`}
        >
          <span aria-hidden="true">{delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}</span>
          {delta === 0
            ? "Same as before"
            : `${Math.abs(delta)}% ${delta > 0 ? "more" : "fewer"} than before`}
        </p>
      )}
      {note && <p className="text-ink-muted text-xs">{note}</p>}
    </div>
  );
}

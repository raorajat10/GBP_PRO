import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { change, totalsOf, type MetricDay } from "@/lib/owner/analytics";
import { getOwnerContext } from "@/lib/owner/context";
import { isMonthKey, monthDays, monthLabel, shiftMonth } from "@/lib/owner/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { scoreBand } from "@/components/score-badge";
import { NoBusiness, NoProfile, nf, Panel } from "@/components/owner/ui";
import { PrintButton } from "../print-button";

export const metadata: Metadata = { title: "Monthly report" };

export default function ReportPage({ params }: PageProps<"/home/insights/reports/[month]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      {params.then(({ month }) => {
        if (!isMonthKey(month)) notFound();
        return <Report month={month} />;
      })}
    </Suspense>
  );
}

const IST_DAY_START = (d: string) => `${d}T00:00:00+05:30`;

async function Report({ month }: { month: string }) {
  const { business, location, snapshot } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Your monthly reports" />;
  const supabase = await createSupabaseServerClient();
  const { first, last } = monthDays(month);
  const prev = monthDays(shiftMonth(month, -1));
  const nextStart = IST_DAY_START(monthDays(shiftMonth(month, 1)).first);

  const [metrics, prevMetrics, reviews, allReviews, posts, audit] = await Promise.all([
    supabase
      .from("location_metrics_daily")
      .select("day, impressions_search, impressions_maps, calls, direction_requests, website_clicks")
      .eq("location_id", location.id)
      .gte("day", first)
      .lte("day", last),
    supabase
      .from("location_metrics_daily")
      .select("day, impressions_search, impressions_maps, calls, direction_requests, website_clicks")
      .eq("location_id", location.id)
      .gte("day", prev.first)
      .lte("day", prev.last),
    supabase
      .from("reviews")
      .select("star_rating, replied_at")
      .eq("client_id", business.id)
      .gte("reviewed_at", IST_DAY_START(first))
      .lt("reviewed_at", nextStart),
    supabase
      .from("reviews")
      .select("star_rating")
      .eq("client_id", business.id)
      .lt("reviewed_at", nextStart)
      .limit(10000),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", business.id)
      .eq("status", "published")
      .gte("published_at", IST_DAY_START(first))
      .lt("published_at", nextStart),
    supabase
      .from("audits")
      .select("score, created_at")
      .eq("location_id", location.id)
      .lt("created_at", nextStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const now = totalsOf((metrics.data ?? []) as MetricDay[]);
  const before = prevMetrics.data?.length ? totalsOf(prevMetrics.data as MetricDay[]) : null;
  const newReviews = reviews.data ?? [];
  const newAvg = newReviews.length
    ? Math.round((newReviews.reduce((t, r) => t + r.star_rating, 0) / newReviews.length) * 10) / 10
    : null;
  const cumulative = allReviews.data ?? [];
  const overallAvg = cumulative.length
    ? Math.round((cumulative.reduce((t, r) => t + r.star_rating, 0) / cumulative.length) * 10) / 10
    : null;
  const replied = newReviews.filter((r) => r.replied_at).length;
  const days = metrics.data?.length ?? 0;

  const rows: { label: string; value: string; delta: number | null }[] = [
    { label: "Profile views", value: nf.format(now.views), delta: change(now.views, before?.views) },
    { label: "From Google Search", value: nf.format(now.search), delta: change(now.search, before?.search) },
    { label: "From Google Maps", value: nf.format(now.maps), delta: change(now.maps, before?.maps) },
    { label: "Calls", value: nf.format(now.calls), delta: change(now.calls, before?.calls) },
    { label: "Direction requests", value: nf.format(now.directions), delta: change(now.directions, before?.directions) },
    { label: "Website clicks", value: nf.format(now.website), delta: change(now.website, before?.website) },
  ];

  return (
    <article className="flex flex-col gap-6 print:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/home/insights/reports" className="text-primary text-sm hover:underline print:hidden">
            All reports
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            {monthLabel(month)} report
          </h1>
          <p className="text-ink-muted">
            {snapshot?.profile.title ?? business.name}
            {days ? `, ${days} days of Google data` : ""}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Big label="Profile views" value={nf.format(now.views)} delta={change(now.views, before?.views)} />
        <Big label="Customer actions" value={nf.format(now.actions)} delta={change(now.actions, before?.actions)} />
        <Big
          label="Profile score"
          value={audit.data ? String(audit.data.score) : "–"}
          tone={audit.data ? scoreBand(audit.data.score).text : undefined}
        />
      </div>

      <Panel title="Visibility and actions" description="Compared with the month before">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-ink-muted text-left">
              <th className="py-1.5 font-medium">Measure</th>
              <th className="py-1.5 text-right font-medium">{monthLabel(month)}</th>
              <th className="py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-line border-t">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right font-semibold">{r.value}</td>
                <td className="py-2 text-right">
                  <Delta value={r.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <Panel title="Reviews">
          <dl className="divide-line flex flex-col divide-y text-sm">
            <Line label="New reviews this month" value={nf.format(newReviews.length)} />
            <Line label="Their average rating" value={newAvg != null ? `${newAvg} ★` : "–"} />
            <Line label="Replied to" value={newReviews.length ? `${replied} of ${newReviews.length}` : "–"} />
            <Line label="Overall rating at month end" value={overallAvg != null ? `${overallAvg} ★ (${nf.format(cumulative.length)})` : "–"} />
          </dl>
        </Panel>
        <Panel title="Our work for you">
          <dl className="divide-line flex flex-col divide-y text-sm">
            <Line label="Posts published" value={nf.format(posts.count ?? 0)} />
            <Line label="Reviews answered" value={nf.format(replied)} />
            <Line label="Score at month end" value={audit.data ? `${audit.data.score} / 100` : "–"} />
          </dl>
        </Panel>
      </div>
    </article>
  );
}

function Big({ label, value, delta, tone }: { label: string; value: string; delta?: number | null; tone?: string }) {
  return (
    <div className="border-line bg-surface rounded-2xl border px-5 py-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className={`text-4xl font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
      {delta !== undefined && <Delta value={delta} />}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-muted text-xs">–</span>;
  const cls = value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-ink-muted";
  return (
    <span className={`text-xs font-semibold ${cls}`}>
      {value > 0 ? "▲ +" : value < 0 ? "▼ " : ""}
      {value}%
    </span>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

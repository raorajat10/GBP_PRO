import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getLatestAudit } from "@/lib/audit/service";
import { serverEnv } from "@/lib/env";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
import { getOwnerContext } from "@/lib/owner/context";
import {
  breakdownRows,
  ownerTasks,
  scoreChange,
  teamWorkItems,
  type OwnerAuditItem,
} from "@/lib/owner/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { scoreBand } from "@/components/score-badge";
import { ScoreGauge } from "@/components/score-gauge";
import { BreakdownRow } from "@/components/owner/breakdown-row";
import { PostStatusChip } from "@/components/post-status-chip";
import { Empty, fmtDate, NoBusiness, nf, Panel, Pill, Stars } from "@/components/owner/ui";
import { TopCompetitors } from "@/components/owner/top-competitors";
import { ShareReviewLink } from "./share-review-link";

export const metadata: Metadata = { title: "Home" };

/** The business owner's home: score, what to do, reviews, numbers and posts. */
export default function ClientHomePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ClientHome />
    </Suspense>
  );
}

const SHOWN_POST_STATUSES = ["pending_approval", "scheduled", "publishing", "published"];

async function ClientHome() {
  const { user, business, location, snapshot } = await getOwnerContext();
  const greeting = (
    <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
      Namaste{user.fullName ? `, ${user.fullName}` : ""}
    </h1>
  );
  if (!business) {
    return (
      <>
        {greeting}
        <NoBusiness />
      </>
    );
  }

  const reviewSlug = business.status === "active" ? business.slug : null;
  const supabase = await createSupabaseServerClient();
  const [audit, postsResult] = await Promise.all([
    location ? getLatestAudit(location.id) : Promise.resolve(null),
    supabase
      .from("posts")
      .select("id, status, body, scheduled_for, published_at, updated_at")
      .eq("client_id", business.id)
      .in("status", SHOWN_POST_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  const posts = postsResult.data ?? [];
  const pendingApprovals = posts.filter((p) => p.status === "pending_approval").length;
  const items: OwnerAuditItem[] = (audit?.items ?? []).map((i) => ({
    key: i.key,
    title: i.title,
    status: i.status,
    points: i.points,
    pointsMax: i.pointsMax,
    rank: i.rank,
  }));
  const tasks = ownerTasks({ items, pendingApprovals, reviewPageSlug: reviewSlug });
  const teamWork = teamWorkItems(items);

  return (
    <>
      <div>
        {greeting}
        <p className="text-ink-muted">
          {business.name}
          {snapshot?.syncedAt && <>, Google data from {fmtDate(snapshot.syncedAt)}</>}
        </p>
      </div>

      <section aria-label="Overview" className="grid gap-4 md:grid-cols-3">
        <Panel
          title="Profile score"
          description="Health of your Google profile"
          actions={
            audit ? (
              <Link
                href="/home/insights/score"
                className="text-primary text-sm font-medium hover:underline"
              >
                Full report
              </Link>
            ) : undefined
          }
        >
          {audit ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <ScoreGauge score={audit.score} />
              <p className={`text-sm font-semibold ${scoreBand(audit.score).text}`}>
                {scoreBand(audit.score).label}
              </p>
              <ScoreTrend score={audit.score} previous={audit.previousScore} />
            </div>
          ) : (
            <Empty>
              {location
                ? "Our team will check your profile soon. Your score will appear here."
                : "Your Google profile score will appear here once our team links your profile."}
            </Empty>
          )}
        </Panel>

        <Panel
          title="Reviews"
          description="What customers say on Google"
          actions={
            snapshot ? (
              <Link
                href="/home/reviews"
                className="text-primary text-sm font-medium hover:underline"
              >
                All reviews
              </Link>
            ) : undefined
          }
        >
          {snapshot ? (
            <dl className="divide-line flex flex-col divide-y">
              <Stat
                label="Average rating"
                value={snapshot.reviews.average != null ? `${snapshot.reviews.average} ★` : "–"}
              />
              <Stat label="Total reviews" value={nf.format(snapshot.reviews.total)} />
              <Stat label="New in last 90 days" value={nf.format(snapshot.reviews.last90Days)} />
              <Stat label="Waiting for a reply" value={nf.format(snapshot.reviews.unanswered)} />
            </dl>
          ) : (
            <Empty>Review numbers appear once your Google profile is linked.</Empty>
          )}
        </Panel>

        <Panel
          title="Customers reached"
          description={
            snapshot?.metrics.days
              ? `Last ${snapshot.metrics.days} days on Google`
              : "From Google Search and Maps"
          }
          actions={
            snapshot?.metrics.days ? (
              <Link
                href="/home/insights/analytics"
                className="text-primary text-sm font-medium hover:underline"
              >
                Analytics
              </Link>
            ) : undefined
          }
        >
          {snapshot?.metrics.days ? (
            <dl className="divide-line flex flex-col divide-y">
              <Stat label="Profile views" value={nf.format(snapshot.metrics.impressions)} />
              <Stat label="Calls" value={nf.format(snapshot.metrics.calls)} />
              <Stat
                label="Direction requests"
                value={nf.format(snapshot.metrics.directionRequests)}
              />
              <Stat label="Website clicks" value={nf.format(snapshot.metrics.websiteClicks)} />
            </dl>
          ) : (
            <Empty>Visit numbers appear once Google has data for your profile.</Empty>
          )}
        </Panel>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel id="focus" title="Your focus" description="Small things only you can do">
          {tasks.length ? (
            <ul className="flex flex-col gap-3">
              {tasks.map((t) => (
                <li key={t.id} className="border-line rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{t.title}</p>
                    <Pill tone="primary">{t.tag}</Pill>
                  </div>
                  <p className="text-ink-muted mt-1 text-sm">{t.why}</p>
                  {t.action?.kind === "share-review-page" && (
                    <div className="mt-3">
                      <ShareReviewLink
                        slug={t.action.slug}
                        businessName={business.name}
                        appUrl={serverEnv().APP_URL}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing needs you right now. We&apos;ll message you on WhatsApp.</Empty>
          )}

          {teamWork.length > 0 && (
            <div className="border-line border-t pt-4">
              <p className="text-ink-muted text-sm font-medium">Our team is working on:</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {teamWork.map((i) => (
                  <li key={i.key} className="flex items-center gap-2">
                    <span className="bg-accent size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                    {i.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel id="score" title="Score breakdown" description="Points in each area">
          {items.length ? (
            <ul className="flex flex-col gap-3">
              {breakdownRows(items).map((i) => (
                <BreakdownRow key={i.key} item={i} />
              ))}
            </ul>
          ) : (
            <Empty>The breakdown appears after our first check of your profile.</Empty>
          )}
        </Panel>
      </div>

      {location && <TopCompetitors locationId={location.id} businessName={business.name} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel id="reviews" title="Recent reviews" description="Newest on your Google profile">
          <RecentReviews snapshot={snapshot} />
        </Panel>

        <Panel
          id="posts"
          title="Posts"
          description="Updates we publish on your profile"
          actions={
            <Link
              href="/home/grow/posts"
              className="text-primary text-sm font-medium hover:underline"
            >
              All posts
            </Link>
          }
        >
          {posts.length ? (
            <ul className="divide-line flex flex-col divide-y">
              {posts.slice(0, 5).map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PostStatusChip status={p.status} />
                    <span className="text-ink-muted text-xs">{postDate(p)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{p.body || "(no text)"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Posts our team prepares for you will show up here.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}

function postDate(p: {
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  updated_at: string;
}) {
  if (p.status === "published" && p.published_at) return `Live since ${fmtDate(p.published_at)}`;
  if (p.scheduled_for) return `Goes live ${fmtDate(p.scheduled_for)}`;
  return `Sent ${fmtDate(p.updated_at)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-sm">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function ScoreTrend({ score, previous }: { score: number; previous: number | null }) {
  const change = scoreChange(score, previous);
  if (!change) return <p className="text-ink-muted text-xs">First check of your profile</p>;
  const style =
    change.delta > 0
      ? "bg-success/10 text-success"
      : change.delta < 0
        ? "bg-danger/10 text-danger"
        : "bg-paper text-ink-muted";
  return (
    <p className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      <span aria-hidden="true">{change.delta > 0 ? "▲ " : change.delta < 0 ? "▼ " : ""}</span>
      {change.label}
    </p>
  );
}

function RecentReviews({ snapshot }: { snapshot: LocationSnapshot | null }) {
  if (!snapshot) return <Empty>Your latest Google reviews will appear here.</Empty>;
  const recent = snapshot.reviews.recent;
  if (!recent) {
    return <Empty>Your latest reviews will appear after our next update of your profile.</Empty>;
  }
  if (!recent.length) {
    return <Empty>No reviews yet. Share your review page to get the first one.</Empty>;
  }
  return (
    <ul className="divide-line flex flex-col divide-y">
      {recent.map((r) => (
        <li
          key={`${r.createTime}-${r.reviewer}`}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold">{r.reviewer}</span>
              <span className="text-ink-muted">, {fmtDate(r.createTime)}</span>
            </p>
            <Stars rating={r.starRating} />
          </div>
          {r.comment && <p className="text-ink-muted line-clamp-2 text-sm">{r.comment}</p>}
          <p className={`text-xs font-semibold ${r.replied ? "text-success" : "text-ink-muted"}`}>
            {r.replied ? "Replied" : "Reply on the way"}
          </p>
        </li>
      ))}
    </ul>
  );
}

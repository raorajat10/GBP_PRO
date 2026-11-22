import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { brand } from "@/config/brand";
import { requireUser } from "@/lib/auth/dal";
import { getLatestAudit } from "@/lib/audit/service";
import { serverEnv } from "@/lib/env";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";
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
import { PostStatusChip } from "@/components/post-status-chip";
import { ShareReviewLink } from "./share-review-link";

export const metadata: Metadata = { title: "Home" };

/** The business owner's dashboard: score, what to do, reviews, numbers and posts. */
export default function ClientHomePage({ searchParams }: PageProps<"/home">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      {searchParams.then((sp) => (
        <ClientHome selected={typeof sp.b === "string" ? sp.b : undefined} />
      ))}
    </Suspense>
  );
}

const nf = new Intl.NumberFormat("en-IN");
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: brand.timeZone,
});
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

const SHOWN_POST_STATUSES = ["pending_approval", "scheduled", "publishing", "published"];

async function ClientHome({ selected }: { selected?: string }) {
  const user = await requireUser(["client"]);
  const supabase = await createSupabaseServerClient();
  // Row-level security limits every query here to the owner's own businesses.
  const { data: businesses, error } = await supabase
    .from("clients")
    .select("id, business_name, slug, status, locations(id, snapshot)")
    .order("business_name");

  const greeting = (
    <h1 className="text-2xl font-bold">Namaste{user.fullName ? `, ${user.fullName}` : ""}</h1>
  );
  if (error) {
    return (
      <>
        {greeting}
        <p role="alert" className="text-danger">
          Couldn&apos;t load your dashboard. Refresh to try again.
        </p>
      </>
    );
  }
  if (!businesses?.length) {
    return (
      <>
        {greeting}
        <p className="text-ink-muted">Your business will appear here once our team sets it up.</p>
      </>
    );
  }

  const business = businesses.find((b) => b.id === selected) ?? businesses[0];
  const location = business.locations[0] ?? null;
  const snapshot = (location?.snapshot ?? null) as unknown as LocationSnapshot | null;
  const reviewSlug = business.status === "active" ? business.slug : null;

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

  const navLink =
    "hover:bg-surface hover:text-primary text-ink-muted block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <nav aria-label="Dashboard sections">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {[
              ["#overview", "Overview"],
              ["#focus", "Your focus"],
              ["#score", "Score breakdown"],
              ["#reviews", "Reviews"],
              ["#posts", "Posts"],
            ].map(([href, label]) => (
              <li key={href} className="shrink-0">
                <a href={href} className={navLink}>
                  {label}
                </a>
              </li>
            ))}
            {reviewSlug && (
              <li className="shrink-0">
                <a
                  href={`/review/${encodeURIComponent(reviewSlug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={navLink}
                >
                  Review page ↗
                </a>
              </li>
            )}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {greeting}
            <p className="text-ink-muted text-sm">
              {business.business_name}
              {snapshot?.syncedAt && <> · Google data from {fmtDate(snapshot.syncedAt)}</>}
            </p>
          </div>
          {businesses.length > 1 && (
            <nav aria-label="Your businesses" className="flex flex-wrap gap-2">
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/home?b=${b.id}`}
                  aria-current={b.id === business.id ? "page" : undefined}
                  className={
                    b.id === business.id
                      ? "bg-primary text-primary-ink rounded-full px-3 py-1 text-sm font-semibold"
                      : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1 text-sm"
                  }
                >
                  {b.business_name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <section
          id="overview"
          aria-label="Overview"
          className="grid scroll-mt-6 gap-4 md:grid-cols-3"
        >
          <Card title="Profile score" subtitle="Health of your Google profile">
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
          </Card>

          <Card title="Reviews" subtitle="What customers say on Google">
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
          </Card>

          <Card
            title="Customers reached"
            subtitle={
              snapshot?.metrics.days
                ? `Last ${snapshot.metrics.days} days on Google`
                : "From Google Search and Maps"
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
          </Card>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section id="focus" aria-labelledby="focus-h" className="scroll-mt-6">
            <Card title="Your focus" subtitle="Small things only you can do" headingId="focus-h">
              {tasks.length ? (
                <ul className="flex flex-col gap-3">
                  {tasks.map((t) => (
                    <li key={t.id} className="border-line rounded-xl border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{t.title}</p>
                        <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-xs font-semibold uppercase">
                          {t.tag}
                        </span>
                      </div>
                      <p className="text-ink-muted mt-1 text-sm">{t.why}</p>
                      {t.action?.kind === "share-review-page" && (
                        <div className="mt-3">
                          <ShareReviewLink
                            slug={t.action.slug}
                            businessName={business.business_name}
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
                        <span
                          className="bg-accent size-1.5 shrink-0 rounded-full"
                          aria-hidden="true"
                        />
                        {i.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </section>

          <section id="score" aria-labelledby="score-h" className="scroll-mt-6">
            <Card title="Score breakdown" subtitle="Points in each area" headingId="score-h">
              {items.length ? (
                <ul className="flex flex-col gap-3">
                  {breakdownRows(items).map((i) => (
                    <BreakdownRow key={i.key} item={i} />
                  ))}
                </ul>
              ) : (
                <Empty>The breakdown appears after our first check of your profile.</Empty>
              )}
            </Card>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-6">
            <Card
              title="Recent reviews"
              subtitle="Newest on your Google profile"
              headingId="reviews-h"
            >
              <RecentReviews snapshot={snapshot} />
            </Card>
          </section>

          <section id="posts" aria-labelledby="posts-h" className="scroll-mt-6">
            <Card title="Posts" subtitle="Updates we publish on your profile" headingId="posts-h">
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
            </Card>
          </section>
        </div>
      </div>
    </div>
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

function Card({
  title,
  subtitle,
  headingId,
  children,
}: {
  title: string;
  subtitle: string;
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-line bg-surface flex h-full flex-col gap-4 rounded-2xl border p-5">
      <div>
        <h2 id={headingId} className="text-lg font-bold">
          {title}
        </h2>
        <p className="text-ink-muted text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted text-sm">{children}</p>;
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

function BreakdownRow({ item }: { item: OwnerAuditItem }) {
  const pct = item.pointsMax ? Math.round((item.points / item.pointsMax) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{item.title}</span>
        <span className="tabular-nums">
          {item.points} / {item.pointsMax}
        </span>
      </div>
      <div
        className="bg-paper mt-1.5 h-2 overflow-hidden rounded-full"
        role="meter"
        aria-label={item.title}
        aria-valuemin={0}
        aria-valuemax={item.pointsMax}
        aria-valuenow={item.points}
      >
        <div className={`h-full rounded-full ${scoreBand(pct).bar}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
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
            <p className="text-sm font-semibold">
              {r.reviewer}
              <span className="text-ink-muted font-normal"> · {fmtDate(r.createTime)}</span>
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

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="text-accent text-sm tracking-tight"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

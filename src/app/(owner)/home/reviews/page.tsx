import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import {
  parseReviewFilters,
  REVIEWS_PER_PAGE,
  reviewFilterQuery,
  summarizeReviews,
  type ReviewFilters,
} from "@/lib/owner/reviews";
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
  Stars,
} from "@/components/owner/ui";

export const metadata: Metadata = { title: "Google reviews" };

export default function ReviewsPage({ searchParams }: PageProps<"/home/reviews">) {
  return (
    <>
      <PageHeader
        title="Google reviews"
        description="Every review on your Google profile. Our team replies to each one for you."
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        {searchParams.then((sp) => (
          <Reviews filters={parseReviewFilters(sp)} />
        ))}
      </Suspense>
    </>
  );
}

async function Reviews({ filters }: { filters: ReviewFilters }) {
  const { business, location } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Your reviews" />;
  const supabase = await createSupabaseServerClient();

  const { data: all } = await supabase
    .from("reviews")
    .select("star_rating, replied_at")
    .eq("client_id", business.id)
    .limit(10000);
  const summary = summarizeReviews(
    (all ?? []).map((r) => ({ star_rating: r.star_rating, replied: r.replied_at != null })),
  );
  if (summary.total === 0) {
    return (
      <Panel>
        <Empty>
          Your reviews will appear here after our next update of your Google profile. Our team
          updates it regularly.
        </Empty>
      </Panel>
    );
  }

  let q = supabase
    .from("reviews")
    .select("id, reviewer, star_rating, comment, reviewed_at, reply_comment, replied_at", {
      count: "exact",
    })
    .eq("client_id", business.id);
  if (filters.stars) q = q.eq("star_rating", filters.stars);
  if (filters.reply === "replied") q = q.not("replied_at", "is", null);
  if (filters.reply === "unreplied") q = q.is("replied_at", null);
  q =
    filters.sort === "oldest"
      ? q.order("reviewed_at", { ascending: true })
      : filters.sort === "lowest"
        ? q.order("star_rating", { ascending: true }).order("reviewed_at", { ascending: false })
        : filters.sort === "highest"
          ? q.order("star_rating", { ascending: false }).order("reviewed_at", { ascending: false })
          : q.order("reviewed_at", { ascending: false });
  const from = (filters.page - 1) * REVIEWS_PER_PAGE;
  const { data: rows, count } = await q.range(from, from + REVIEWS_PER_PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / REVIEWS_PER_PAGE));
  const max = Math.max(...summary.counts, 1);

  return (
    <>
      <Panel>
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-ink-muted text-sm">Average rating</p>
              <p className="text-4xl font-bold tabular-nums">{summary.average ?? "–"}</p>
              {summary.average != null && <Stars rating={summary.average} size="lg" />}
              <p className="text-ink-muted text-sm">{nf.format(summary.total)} reviews</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-ink-muted text-sm">Replied</p>
                <p className="text-xl font-bold tabular-nums">
                  {summary.replyRate == null ? "–" : `${Math.round(summary.replyRate * 100)}%`}
                </p>
              </div>
              <div>
                <p className="text-ink-muted text-sm">Needs a reply</p>
                <p
                  className={`text-xl font-bold tabular-nums ${summary.needsReply ? "text-accent" : ""}`}
                >
                  {nf.format(summary.needsReply)}
                </p>
              </div>
            </div>
          </div>
          <ul className="flex flex-col justify-center gap-2" aria-label="Reviews by stars">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = summary.counts[s - 1];
              return (
                <li key={s}>
                  <Link
                    href={`/home/reviews${reviewFilterQuery({ ...filters, stars: s as ReviewFilters["stars"], page: 1 })}`}
                    className="hover:bg-paper grid grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-3 rounded-lg px-1 py-0.5 text-sm"
                  >
                    <span className="tabular-nums">{s} ★</span>
                    <span className="bg-paper h-2.5 overflow-hidden rounded-full">
                      <span
                        className="bg-accent block h-full rounded-full"
                        style={{ width: `${(n / max) * 100}%` }}
                      />
                    </span>
                    <span className="text-ink-muted text-right tabular-nums">
                      {nf.format(n)} ({summary.total ? Math.round((n / summary.total) * 100) : 0}%)
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      <nav aria-label="Filter reviews" className="flex flex-wrap items-center gap-2 text-sm">
        <FilterLink filters={filters} change={{ stars: null, reply: "all" }} label="All" />
        <FilterLink filters={filters} change={{ reply: "unreplied" }} label="Needs a reply" />
        <FilterLink filters={filters} change={{ reply: "replied" }} label="Replied" />
        <FilterLink
          filters={filters}
          change={{ stars: null, reply: "all", sort: "lowest" }}
          label="Lowest first"
        />
        {filters.stars && (
          <Link
            href={`/home/reviews${reviewFilterQuery({ ...filters, stars: null, page: 1 })}`}
            className="bg-primary-soft text-primary rounded-full px-3 py-1 font-semibold"
          >
            {filters.stars} stars only ✕
          </Link>
        )}
        <span className="text-ink-muted ml-auto">
          {nf.format(count ?? 0)} {count === 1 ? "review" : "reviews"}
        </span>
      </nav>

      <Panel>
        {rows?.length ? (
          <ul className="divide-line flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="font-semibold">{r.reviewer}</span>
                    <span className="text-ink-muted text-sm">, {fmtDate(r.reviewed_at)}</span>
                  </p>
                  <Stars rating={r.star_rating} />
                </div>
                {r.comment ? (
                  <p className="text-sm leading-relaxed">{r.comment}</p>
                ) : (
                  <p className="text-ink-muted text-sm">Rating only, no comment.</p>
                )}
                {r.reply_comment ? (
                  <div className="border-primary bg-primary-soft/50 rounded-r-lg border-l-2 px-3 py-2 text-sm">
                    <p className="text-primary text-xs font-semibold">
                      Your reply{r.replied_at ? `, ${fmtDate(r.replied_at)}` : ""}
                    </p>
                    <p className="mt-0.5">{r.reply_comment}</p>
                  </div>
                ) : (
                  <div>
                    <Pill tone="accent">Reply on the way</Pill>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No reviews match these filters.</Empty>
        )}
      </Panel>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
          {filters.page > 1 ? (
            <Link
              href={`/home/reviews${reviewFilterQuery({ ...filters, page: filters.page - 1 })}`}
              className="border-line hover:bg-paper rounded-lg border px-3 py-1.5"
            >
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages ? (
            <Link
              href={`/home/reviews${reviewFilterQuery({ ...filters, page: filters.page + 1 })}`}
              className="border-line hover:bg-paper rounded-lg border px-3 py-1.5"
            >
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function FilterLink({
  filters,
  change,
  label,
}: {
  filters: ReviewFilters;
  change: Partial<ReviewFilters>;
  label: string;
}) {
  const next = { ...filters, sort: "newest" as const, ...change, page: 1 };
  const active =
    next.reply === filters.reply && next.sort === filters.sort && next.stars === filters.stars;
  return (
    <Link
      href={`/home/reviews${reviewFilterQuery(next)}`}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
          : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
      }
    >
      {label}
    </Link>
  );
}

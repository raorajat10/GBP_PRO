import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import type { Language } from "@/lib/clients/schema";
import { replyLanguage } from "@/lib/reviews/language";
import { thankYouReplies } from "@/lib/reviews/thank-you";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { ReplyComposer } from "./reply-composer";

export const metadata: Metadata = { title: "Review inbox" };

const PAGE_SIZE = 30;
const SHOW = ["needs", "replied", "all"] as const;
type Show = (typeof SHOW)[number];

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export default function ReviewInboxPage({ searchParams }: PageProps<"/reviews">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Review inbox</h1>
        <p className="text-ink-muted text-sm">
          Google reviews for your clients. Pick a ready thank-you reply, edit it if you like, and
          post it on Google.
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={5} />}>
        {searchParams.then((sp) => {
          const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
          const show = (SHOW as readonly string[]).includes(one(sp.show) ?? "")
            ? (one(sp.show) as Show)
            : "needs";
          const client = z.uuid().safeParse(one(sp.client)).success ? one(sp.client)! : null;
          const stars = Number(one(sp.stars));
          const page = Math.max(1, Math.min(200, Math.floor(Number(one(sp.page)) || 1)));
          return (
            <Inbox
              show={show}
              client={client}
              stars={[1, 2, 3, 4, 5].includes(stars) ? stars : null}
              page={page}
            />
          );
        })}
      </Suspense>
    </>
  );
}

async function Inbox(f: { show: Show; client: string | null; stars: number | null; page: number }) {
  await requireUser(["admin", "manager"]);
  const supabase = await createSupabaseServerClient();
  // Row-level security limits clients and reviews to the ones this person manages.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("status", "active")
    .order("business_name");

  let q = supabase
    .from("reviews")
    .select(
      "id, client_id, reviewer, star_rating, comment, reviewed_at, reply_comment, replied_at, client:clients(business_name, preferred_language)",
      { count: "exact" },
    );
  if (f.client) q = q.eq("client_id", f.client);
  if (f.stars) q = q.eq("star_rating", f.stars);
  if (f.show === "needs") q = q.is("replied_at", null);
  if (f.show === "replied") q = q.not("replied_at", "is", null);
  const from = (f.page - 1) * PAGE_SIZE;
  const { data: reviews, count } = await q
    .order("reviewed_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  let needsQ = supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .is("replied_at", null);
  if (f.client) needsQ = needsQ.eq("client_id", f.client);
  const { count: needsCount } = await needsQ;

  const href = (change: Partial<typeof f>) => {
    const n = { ...f, page: 1, ...change };
    const p = new URLSearchParams();
    if (n.show !== "needs") p.set("show", n.show);
    if (n.client) p.set("client", n.client);
    if (n.stars) p.set("stars", String(n.stars));
    if (n.page > 1) p.set("page", String(n.page));
    const s = p.toString();
    return s ? `/reviews?${s}` : "/reviews";
  };
  const pill = (active: boolean) =>
    active
      ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
      : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1";
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <nav aria-label="Filter reviews" className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ show: "needs" })} className={pill(f.show === "needs")}>
            Needs a reply <span className="tabular-nums">{needsCount ?? 0}</span>
          </Link>
          <Link href={href({ show: "replied" })} className={pill(f.show === "replied")}>
            Replied
          </Link>
          <Link href={href({ show: "all" })} className={pill(f.show === "all")}>
            All
          </Link>
          <span className="border-line mx-1 border-l" aria-hidden="true" />
          {[5, 4, 3, 2, 1].map((s) => (
            <Link
              key={s}
              href={href({ stars: f.stars === s ? null : s })}
              aria-current={f.stars === s ? "true" : undefined}
              className={pill(f.stars === s)}
            >
              {s} ★
            </Link>
          ))}
        </div>
        {clients && clients.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Link href={href({ client: null })} className={pill(!f.client)}>
              All clients
            </Link>
            {clients.map((c) => (
              <Link key={c.id} href={href({ client: c.id })} className={pill(f.client === c.id)}>
                {c.business_name}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {reviews?.length ? (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-semibold">{r.reviewer}</span>
                  <span className="text-ink-muted text-sm">
                    {" "}
                    for {r.client?.business_name}, {dateFmt.format(new Date(r.reviewed_at))}
                  </span>
                </p>
                <span
                  className="text-accent"
                  role="img"
                  aria-label={`${r.star_rating} out of 5 stars`}
                >
                  {"★".repeat(r.star_rating)}
                  <span className="text-line">{"★".repeat(5 - r.star_rating)}</span>
                </span>
              </div>
              {r.comment ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">{r.comment}</p>
              ) : (
                <p className="text-ink-muted text-sm">Rating only, no comment.</p>
              )}
              {r.reply_comment && (
                <div className="border-primary bg-primary-soft/50 rounded-r-lg border-l-2 px-3 py-2 text-sm">
                  <p className="text-primary text-xs font-semibold">
                    Reply on Google
                    {r.replied_at ? `, ${dateFmt.format(new Date(r.replied_at))}` : ""}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line">{r.reply_comment}</p>
                </div>
              )}
              <ReplyComposer
                reviewId={r.id}
                existingReply={r.reply_comment}
                options={thankYouReplies({
                  reviewer: r.reviewer,
                  stars: r.star_rating,
                  business: r.client?.business_name ?? "",
                  language: replyLanguage(
                    r.comment,
                    (r.client?.preferred_language as Language | undefined) ?? "en",
                  ),
                })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-line bg-surface text-ink-muted rounded-2xl border border-dashed p-8 text-center">
          {f.show === "needs"
            ? "Every review has a reply. Nice work."
            : "No reviews match these filters."}
        </p>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {f.page > 1 ? (
            <Link href={href({ ...f, page: f.page - 1 })} className={pill(false)}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            Page {f.page} of {pages}
          </span>
          {f.page < pages ? (
            <Link href={href({ ...f, page: f.page + 1 })} className={pill(false)}>
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

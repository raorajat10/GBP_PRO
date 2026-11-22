import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import {
  Empty,
  Figure,
  fmtDateTime,
  NoBusiness,
  nf,
  PageHeader,
  Panel,
  Pill,
  Stars,
} from "@/components/owner/ui";
import { setFeedbackStatus } from "./actions";

export const metadata: Metadata = { title: "Private feedback" };

const STATUS = {
  pending: { label: "New", tone: "accent" },
  contacted: { label: "Contacted", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
} as const;
type Status = keyof typeof STATUS;

export default function FeedbackPage({ searchParams }: PageProps<"/home/reviews/feedback">) {
  return (
    <>
      <PageHeader
        title="Private feedback"
        description="Messages customers left on your review page instead of posting on Google. Only you and our team see them."
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        {searchParams.then((sp) => {
          const s = typeof sp.status === "string" ? sp.status : "";
          return <Feedback status={s in STATUS ? (s as Status) : null} />;
        })}
      </Suspense>
    </>
  );
}

async function Feedback({ status }: { status: Status | null }) {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("review_feedback")
    .select("id, rating, message, contact, status, created_at")
    .eq("client_id", business.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const all = data ?? [];
  const count = (s: Status) => all.filter((f) => f.status === s).length;
  const rated = all.filter((f) => f.rating != null);
  const avg = rated.length
    ? Math.round((rated.reduce((t, f) => t + (f.rating ?? 0), 0) / rated.length) * 10) / 10
    : null;
  const shown = status ? all.filter((f) => f.status === status) : all;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Figure label="All feedback" value={nf.format(all.length)} />
        <Figure label="New" value={nf.format(count("pending"))} tone={count("pending") ? "accent" : "ink"} />
        <Figure label="Contacted" value={nf.format(count("contacted"))} />
        <Figure label="Resolved" value={nf.format(count("resolved"))} />
        <Figure label="Average stars" value={avg ?? "–"} />
      </div>

      <nav aria-label="Filter feedback" className="flex flex-wrap gap-2 text-sm">
        {([null, "pending", "contacted", "resolved"] as const).map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/home/reviews/feedback?status=${s}` : "/home/reviews/feedback"}
            aria-current={s === status ? "page" : undefined}
            className={
              s === status
                ? "bg-primary text-primary-ink rounded-full px-3 py-1 font-semibold"
                : "border-line bg-surface hover:border-primary rounded-full border px-3 py-1"
            }
          >
            {s ? STATUS[s].label : "All"}
          </Link>
        ))}
      </nav>

      <Panel>
        {shown.length ? (
          <ul className="divide-line flex flex-col divide-y">
            {shown.map((f) => {
              const st = STATUS[(f.status as Status) ?? "pending"] ?? STATUS.pending;
              return (
                <li key={f.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {f.rating != null ? <Stars rating={f.rating} /> : <span className="text-ink-muted text-sm">No stars</span>}
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <span className="text-ink-muted text-xs">{fmtDateTime(f.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{f.message}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      {f.contact ? (
                        <>
                          <span className="text-ink-muted">Contact: </span>
                          <span className="font-medium">{f.contact}</span>
                        </>
                      ) : (
                        <span className="text-ink-muted">No contact details left</span>
                      )}
                    </p>
                    <form action={setFeedbackStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={f.id} />
                      {f.status !== "contacted" && f.status !== "resolved" && (
                        <button name="status" value="contacted" className="border-line hover:bg-paper rounded-lg border px-3 py-1 text-sm">
                          Mark contacted
                        </button>
                      )}
                      {f.status !== "resolved" ? (
                        <button name="status" value="resolved" className="bg-primary text-primary-ink rounded-lg px-3 py-1 text-sm font-semibold">
                          Mark resolved
                        </button>
                      ) : (
                        <button name="status" value="pending" className="text-ink-muted text-sm hover:underline">
                          Reopen
                        </button>
                      )}
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            {all.length
              ? "Nothing here with this status."
              : "No private feedback yet. When a customer has a problem, your review page lets them tell you privately first."}
          </Empty>
        )}
      </Panel>
    </>
  );
}

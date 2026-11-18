import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { ScoreBadge, scoreBand } from "@/components/score-badge";

export const metadata: Metadata = { title: "Home" };

/** The business owner's simple view. Grows in later milestones (approvals, report). */
export default function ClientHomePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <ClientHome />
    </Suspense>
  );
}

async function ClientHome() {
  const user = await requireUser(["client"]);
  const supabase = await createSupabaseServerClient();
  // Row-level security limits every query here to the owner's own business.
  const { data: businesses } = await supabase
    .from("clients")
    .select("id, business_name, locations(id, audit_score)")
    .order("business_name");

  return (
    <>
      <h1 className="text-2xl font-bold">Namaste{user.fullName ? `, ${user.fullName}` : ""}</h1>
      {businesses?.length ? (
        <ul className="flex flex-col gap-3">
          {businesses.map((b) => (
            <li
              key={b.id}
              className="border-line bg-surface flex flex-col gap-3 rounded-xl border px-4 py-3"
            >
              <p className="font-semibold">{b.business_name}</p>
              {b.locations[0]?.audit_score != null ? (
                <OwnerScore locationId={b.locations[0].id} score={b.locations[0].audit_score} />
              ) : (
                <p className="text-ink-muted text-sm">
                  Your Google profile score will appear here once our team links your profile.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">Your business will appear here once our team sets it up.</p>
      )}
    </>
  );
}

async function OwnerScore({ locationId, score }: { locationId: string; score: number }) {
  const supabase = await createSupabaseServerClient();
  const { data: audit } = await supabase
    .from("audits")
    .select("audit_items(title, status, rank)")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const top = (audit?.audit_items ?? [])
    .filter((i) => i.status !== "pass")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <ScoreBadge score={score} size="lg" />
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          Google profile score: <span className="font-semibold">{scoreBand(score).label}</span>
        </p>
        {top.length > 0 && (
          <>
            <p className="text-ink-muted text-sm">What our team is working on next:</p>
            <ul className="list-disc pl-5 text-sm">
              {top.map((i) => (
                <li key={i.title}>{i.title}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { monthKey, monthLabel, reportMonths } from "@/lib/owner/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { Empty, NoBusiness, NoProfile, PageHeader, Panel, Pill } from "@/components/owner/ui";

export const metadata: Metadata = { title: "Monthly reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Monthly reports"
        description="A one-page summary of each month: views, calls, reviews, posts and your score. Open one to print or save it as a PDF."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Reports />
      </Suspense>
    </>
  );
}

async function Reports() {
  const { business, location } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  if (!location) return <NoProfile what="Your monthly reports" />;
  const supabase = await createSupabaseServerClient();
  const { data: first } = await supabase
    .from("location_metrics_daily")
    .select("day")
    .eq("location_id", location.id)
    .order("day")
    .limit(1)
    .maybeSingle();
  const months = reportMonths(new Date(), first?.day ?? null);
  const current = monthKey(new Date());

  return (
    <Panel>
      {months.length ? (
        <ul className="divide-line flex flex-col divide-y">
          {months.map((m) => (
            <li key={m}>
              <Link
                href={`/home/insights/reports/${m}`}
                className="hover:text-primary flex items-center justify-between gap-3 py-3"
              >
                <span className="font-semibold">{monthLabel(m)}</span>
                {m === current ? <Pill tone="accent">So far this month</Pill> : <Pill tone="success">Complete</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Your first report appears once we have a few days of Google data.</Empty>
      )}
    </Panel>
  );
}

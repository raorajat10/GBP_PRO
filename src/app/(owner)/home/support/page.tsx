import type { Metadata } from "next";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { FAQ, labelOf, TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/owner/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { Empty, fmtDate, NoBusiness, PageHeader, Panel, Pill } from "@/components/owner/ui";
import { TicketForm } from "./ticket-form";

export const metadata: Metadata = { title: "Help & support" };

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Help & support" description="Ask our team anything. We reply here and on WhatsApp." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Ask our team">
          <TicketForm />
        </Panel>
        <Panel title="Common questions">
          <div className="flex flex-col">
            {FAQ.map((f) => (
              <details key={f.q} className="border-line group border-b py-3 last:border-b-0">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </Panel>
      </div>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Tickets />
      </Suspense>
    </>
  );
}

async function Tickets() {
  const { business } = await getOwnerContext();
  if (!business) return <NoBusiness />;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, subject, category, status, description, team_reply, created_at, updated_at")
    .eq("client_id", business.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <Panel id="tickets" title="Your requests">
      {data?.length ? (
        <ul className="divide-line flex flex-col divide-y">
          {data.map((t) => {
            const s = TICKET_STATUS[t.status as keyof typeof TICKET_STATUS] ?? TICKET_STATUS.open;
            return (
              <li key={t.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t.subject}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted text-xs">
                      {labelOf(TICKET_CATEGORIES, t.category)}, {fmtDate(t.created_at)}
                    </span>
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </div>
                </div>
                <p className="text-ink-muted text-sm whitespace-pre-line">{t.description}</p>
                {t.team_reply && (
                  <div className="border-primary bg-primary-soft/50 rounded-r-lg border-l-2 px-3 py-2 text-sm">
                    <p className="text-primary text-xs font-semibold">Our team, {fmtDate(t.updated_at)}</p>
                    <p className="mt-0.5 whitespace-pre-line">{t.team_reply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No requests yet.</Empty>
      )}
    </Panel>
  );
}

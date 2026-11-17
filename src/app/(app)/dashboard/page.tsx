import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { INDUSTRIES, LANGUAGES, labelFor } from "@/lib/clients/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { StatusChip } from "@/components/status-chip";
import { GbpStatusBanner } from "@/components/gbp-status-banner";

export const metadata: Metadata = { title: "Clients" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="text-2xl font-bold">Clients</h1>
          <ListSkeleton />
        </>
      }
    >
      {searchParams.then((sp) => (
        <>
          <GbpStatusBanner status={sp.gbp} />
          <ClientList />
        </>
      ))}
    </Suspense>
  );
}

async function ClientList() {
  const user = await requireUser(["admin", "manager"]);
  const isAdmin = user.role === "admin";
  const supabase = await createSupabaseServerClient();
  // Row-level security returns only the clients this user may see.
  const { data: clients, error } = await supabase
    .from("clients")
    .select(
      "id, business_name, industry, status, preferred_language, owner_whatsapp, whatsapp_opt_in_at, manager:profiles!clients_assigned_manager_id_fkey(full_name, email), locations(id)",
    )
    .order("business_name");

  const active = clients?.filter((c) => c.status === "active").length ?? 0;
  const noConsent =
    clients?.filter((c) => c.status === "active" && !c.whatsapp_opt_in_at).length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "All clients" : "My clients"}</h1>
          {clients && clients.length > 0 && (
            <p className="text-ink-muted text-sm">
              {active} active
              {noConsent > 0 && (
                <>
                  {" · "}
                  <span className="text-ink font-medium">{noConsent} without WhatsApp consent</span>
                </>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <Link
            href="/clients/new"
            className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold"
          >
            Add client
          </Link>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-danger">
          Couldn&apos;t load clients. Refresh to try again.
        </p>
      ) : !clients?.length ? (
        <div className="border-line bg-surface text-ink-muted rounded-2xl border border-dashed p-8 text-center">
          {isAdmin
            ? "No clients yet. Click “Add client” to add your first one."
            : "No clients are assigned to you yet. Ask an admin to assign some."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="border-line bg-surface hover:border-primary flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.business_name}</p>
                  <p className="text-ink-muted text-sm">
                    {[
                      labelFor(INDUSTRIES, c.industry),
                      labelFor(LANGUAGES, c.preferred_language),
                      isAdmin ? (c.manager?.full_name ?? c.manager?.email ?? "Unassigned") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.status === "active" && c.locations.length === 0 && (
                    <span className="bg-accent-soft rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      Google not linked
                    </span>
                  )}
                  {c.status === "active" && !c.whatsapp_opt_in_at && (
                    <span
                      className="bg-accent-soft rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      title="Approvals can't be sent until the owner agrees to WhatsApp messages"
                    >
                      {c.owner_whatsapp ? "No WhatsApp consent" : "No WhatsApp number"}
                    </span>
                  )}
                  <StatusChip status={c.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

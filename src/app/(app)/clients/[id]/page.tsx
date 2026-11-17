import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { listManagerOptions } from "@/lib/clients/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { StatusChip } from "@/components/status-chip";
import { ClientForm } from "../client-form";
import { OwnerInviteForm } from "../owner-invite-form";
import { inviteOwnerAction, updateClientAction } from "../actions";
import { GbpStatusBanner } from "@/components/gbp-status-banner";
import { GoogleProfileSection } from "./google-profile";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  return (
    <>
      <Link href="/dashboard" className="text-ink-muted hover:text-primary w-fit text-sm">
        ← Clients
      </Link>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
          <ClientDetail id={id} gbpStatus={sp.gbp} />
        ))}
      </Suspense>
    </>
  );
}

async function ClientDetail({
  id,
  gbpStatus,
}: {
  id: string;
  gbpStatus: string | string[] | undefined;
}) {
  const user = await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, business_name, owner_name, owner_whatsapp, whatsapp_opt_in_at, preferred_language, industry, brand_notes, assigned_manager_id, status",
    )
    .eq("id", id)
    .maybeSingle();
  // Not found and "not yours" look the same, so managers can't probe other clients.
  if (!client) notFound();

  const isAdmin = user.role === "admin";
  const managers = await listManagerOptions();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{client.business_name}</h1>
        <StatusChip status={client.status} />
      </div>

      <GbpStatusBanner status={gbpStatus} />
      <GoogleProfileSection clientId={client.id} isAdmin={isAdmin} />

      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        defaults={client}
        managers={managers}
        canAssign={isAdmin}
        submitLabel="Save changes"
      />

      {isAdmin && <OwnerLogins clientId={client.id} />}
    </>
  );
}

async function OwnerLogins({ clientId }: { clientId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: owners } = await supabase
    .from("client_users")
    .select("user_id, profile:profiles(full_name, email)")
    .eq("client_id", clientId);

  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">Owner logins</h2>
        <p className="text-ink-muted text-sm">
          Owners see a simple view of their business. Most of their approvals will happen on
          WhatsApp, so this is optional.
        </p>
      </div>
      {owners?.length ? (
        <ul className="flex flex-col gap-1">
          {owners.map((o) => (
            <li key={o.user_id} className="text-sm">
              <span className="font-medium">{o.profile?.full_name ?? "—"}</span>{" "}
              <span className="text-ink-muted">{o.profile?.email}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted text-sm">No owner logins yet.</p>
      )}
      <OwnerInviteForm action={inviteOwnerAction.bind(null, clientId)} />
    </section>
  );
}

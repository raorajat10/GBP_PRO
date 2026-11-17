import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Clients" };

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Clients</h1>
      <Suspense fallback={<ListSkeleton />}>
        <ClientList />
      </Suspense>
    </>
  );
}

async function ClientList() {
  const user = await requireUser(["admin", "manager"]);
  const supabase = await createSupabaseServerClient();
  // Row-level security returns only the clients this user may see.
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, business_name, industry, status")
    .order("business_name");

  if (error) {
    return (
      <p role="alert" className="text-danger">
        Couldn&apos;t load clients. Refresh to try again.
      </p>
    );
  }

  if (!clients?.length) {
    return (
      <div className="border-line bg-surface text-ink-muted rounded-2xl border border-dashed p-8 text-center">
        {user.role === "admin"
          ? "No clients yet. Adding clients comes in the next update."
          : "No clients are assigned to you yet. Ask an admin to assign some."}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li
          key={c.id}
          className="border-line bg-surface flex items-center justify-between rounded-xl border px-4 py-3"
        >
          <div>
            <p className="font-semibold">{c.business_name}</p>
            {c.industry && <p className="text-ink-muted text-sm capitalize">{c.industry}</p>}
          </div>
          <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">
            {c.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

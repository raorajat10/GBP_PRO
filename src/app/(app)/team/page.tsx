import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Team</h1>
      <Suspense fallback={<ListSkeleton />}>
        <TeamContent />
      </Suspense>
    </>
  );
}

async function TeamContent() {
  await requireUser(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("role", ["admin", "manager"])
    .order("full_name");

  return (
    <>
      <ul className="flex flex-col gap-2">
        {(members ?? []).map((m) => (
          <li
            key={m.id}
            className="border-line bg-surface flex items-center justify-between rounded-xl border px-4 py-3"
          >
            <div>
              <p className="font-semibold">{m.full_name ?? "—"}</p>
              <p className="text-ink-muted text-sm">{m.email}</p>
            </div>
            <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">
              {m.role}
            </span>
          </li>
        ))}
      </ul>
      <InviteForm />
    </>
  );
}

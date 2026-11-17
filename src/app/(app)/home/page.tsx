import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Home" };

/** The business owner's simple view. Grows in later milestones (score, approvals, report). */
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
  const { data: businesses } = await supabase
    .from("clients")
    .select("id, business_name")
    .order("business_name");

  return (
    <>
      <h1 className="text-2xl font-bold">Namaste{user.fullName ? `, ${user.fullName}` : ""}</h1>
      {businesses?.length ? (
        <ul className="flex flex-col gap-2">
          {businesses.map((b) => (
            <li
              key={b.id}
              className="border-line bg-surface rounded-xl border px-4 py-3 font-semibold"
            >
              {b.business_name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">Your business will appear here once our team sets it up.</p>
      )}
    </>
  );
}

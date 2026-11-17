import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "No access yet" };

export default function NoAccessPage() {
  return (
    <Suspense fallback={null}>
      <NoAccess />
    </Suspense>
  );
}

async function NoAccess() {
  const user = await requireUser();
  return (
    <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-8">
      <h1 className="text-xl font-bold">Your account doesn&apos;t have access yet</h1>
      <p className="text-ink-muted">
        You&apos;re signed in as {user.email}, but no role has been assigned. Ask your {brand.name}{" "}
        admin to give you access.
      </p>
    </div>
  );
}

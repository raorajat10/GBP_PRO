import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getAgencyConnection } from "@/lib/gbp/service";
import { serverEnv } from "@/lib/env";
import { ListSkeleton } from "@/components/skeleton";
import { GbpStatusBanner } from "@/components/gbp-status-banner";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <>
      <h1 className="text-2xl font-bold">Settings</h1>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        {searchParams.then((sp) => (
          <GoogleAccess status={sp.gbp} />
        ))}
      </Suspense>
    </>
  );
}

async function GoogleAccess({ status }: { status: string | string[] | undefined }) {
  await requireUser(["admin"]);
  const conn = await getAgencyConnection();
  const sample = serverEnv().GBP_PROVIDER === "mock";

  return (
    <>
      <GbpStatusBanner status={status} />
      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Team Google account</h2>
          {sample && (
            <span className="bg-accent-soft rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Sample data — Google API access pending
            </span>
          )}
        </div>
        <p className="text-ink-muted text-sm">
          Recommended way to manage clients: each owner adds this Google account as a{" "}
          <strong>Manager</strong> on their Business Profile (Business Profile settings → People and
          access → Add). Their profile then appears here, ready to link to the client.
        </p>
        {conn ? (
          <p className="text-sm">
            Connected: <strong>{conn.google_account_label ?? conn.google_account_name}</strong>{" "}
            <span className="text-ink-muted">
              since{" "}
              {new Date(conn.connected_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </span>
          </p>
        ) : (
          <p className="text-sm font-medium">Not connected yet.</p>
        )}
        <a
          href="/api/gbp/connect?mode=agency"
          className={
            conn
              ? "border-line hover:bg-paper w-fit rounded-lg border px-4 py-2"
              : "bg-primary text-primary-ink w-fit rounded-lg px-4 py-2 font-semibold"
          }
        >
          {conn ? "Reconnect" : "Connect team Google account"}
        </a>
      </section>
    </>
  );
}

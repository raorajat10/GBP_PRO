import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getAgencyConnection } from "@/lib/gbp/service";
import { serverEnv } from "@/lib/env";
import { ListSkeleton } from "@/components/skeleton";
import { GbpStatusBanner } from "@/components/gbp-status-banner";
import { GridRankingUsage } from "./grid-ranking-usage";
import {
  googleOAuthConfig,
  readTestResult,
  type TestResult,
} from "@/lib/gbp/google/test-connection";

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
      <Suspense fallback={<ListSkeleton rows={1} />}>
        <GridRankingUsage />
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
      <GoogleTest />
    </>
  );
}

const OUTCOME: Record<TestResult["outcome"], { label: string; tone: string }> = {
  approved: { label: "Working ✅", tone: "border-success bg-primary-soft" },
  not_approved: {
    label: "Signed in — waiting for Google's API approval",
    tone: "border-accent bg-accent-soft",
  },
  api_disabled: { label: "Signed in — APIs not enabled yet", tone: "border-accent bg-accent-soft" },
  no_permission: { label: "Google refused access", tone: "border-danger bg-surface" },
  missing_scope: { label: "Permission not granted", tone: "border-danger bg-surface" },
  cancelled: { label: "Cancelled", tone: "border-line bg-surface" },
  error: { label: "Something went wrong", tone: "border-danger bg-surface" },
};

async function GoogleTest() {
  const configured = Boolean(googleOAuthConfig());
  const result = await readTestResult();
  return (
    <section
      aria-labelledby="google-test-heading"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5"
    >
      <h2 id="google-test-heading" className="text-lg font-semibold">
        Real Google connection test
      </h2>
      <p className="text-ink-muted text-sm">
        Signs in with Google&apos;s real &ldquo;Allow&rdquo; screen and asks Google for the business
        profiles that account manages. It shows whether Google has approved our API access yet.
        Nothing is saved; the rest of the app keeps using sample data until then. Use an account
        listed as a test user in Google Cloud.
      </p>
      {result && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${OUTCOME[result.outcome].tone}`}
        >
          <p className="font-semibold">{OUTCOME[result.outcome].label}</p>
          {result.email && <p>Signed in as {result.email}</p>}
          <p className="text-ink-muted">{result.message}</p>
          {result.locations && result.locations.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {result.locations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {configured ? (
        <a
          href="/api/google/test"
          className="border-line hover:bg-paper w-fit rounded-lg border px-4 py-2"
        >
          {result ? "Test again" : "Test Google connection"}
        </a>
      ) : (
        <p className="text-sm">
          Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to switch this on.
        </p>
      )}
    </section>
  );
}

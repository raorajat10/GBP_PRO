import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Sample Google connection" };

/**
 * Stand-in for Google's consent screen while API access is pending. Deliberately looks
 * like our product (not like Google) and says plainly that it is sample data.
 */
export default function SampleConsentPage({ searchParams }: PageProps<"/connect/google/sample">) {
  return (
    <Suspense fallback={null}>
      {searchParams.then((sp) => (
        <SampleConsent
          state={typeof sp.state === "string" ? sp.state : ""}
          mode={sp.mode === "owner" ? "owner" : "agency"}
        />
      ))}
    </Suspense>
  );
}

async function SampleConsent({ state, mode }: { state: string; mode: "agency" | "owner" }) {
  await requireUser(["admin", "manager"]);
  const callback = (params: Record<string, string>) =>
    `/api/gbp/callback?${new URLSearchParams({ state, ...params }).toString()}`;

  return (
    <div className="border-line bg-surface mx-auto flex w-full max-w-lg flex-col gap-5 rounded-2xl border p-6 sm:p-8">
      <p className="bg-accent-soft rounded-lg px-3 py-2 text-sm font-medium">
        Test mode — Google API access isn&apos;t approved yet, so this connects realistic{" "}
        <strong>sample data</strong>. No real Google account is used.
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">
          {mode === "agency"
            ? "Connect the team Google account"
            : "Connect the owner's Google account"}
        </h1>
        <p className="text-ink-muted text-sm">
          {mode === "agency"
            ? "The sample team account manages six sample business profiles in Jaipur. You'll link each one to a client."
            : "The sample owner account has one business profile. It will be linked to this client automatically."}
        </p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">{brand.name} will be able to:</p>
        <ul className="text-ink-muted list-disc pl-5">
          <li>Read the business profile, photos, reviews and performance numbers</li>
          <li>Publish posts and review replies — only after they are approved</li>
        </ul>
      </div>
      <div className="flex gap-3">
        <a
          href={callback({ code: mode === "agency" ? "sample-team" : "sample-owner" })}
          className="bg-primary text-primary-ink rounded-lg px-5 py-2.5 font-semibold"
        >
          Allow (sample)
        </a>
        <a
          href={callback({ error: "access_denied" })}
          className="border-line hover:bg-paper rounded-lg border px-5 py-2.5"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}

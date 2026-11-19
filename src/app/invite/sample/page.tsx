import type { Metadata } from "next";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { InviteShell } from "../shell";

export const metadata: Metadata = {
  title: "Sample Google connection",
  robots: { index: false, follow: false },
};

/**
 * Stand-in for Google's consent screen for owner invites while API access is pending.
 * Looks like our product (not like Google) and says plainly that it's sample data.
 */
export default function InviteSampleConsentPage({ searchParams }: PageProps<"/invite/sample">) {
  return (
    <InviteShell>
      <Suspense fallback={null}>
        {searchParams.then((sp) => (
          <Consent state={typeof sp.state === "string" ? sp.state : ""} />
        ))}
      </Suspense>
    </InviteShell>
  );
}

function Consent({ state }: { state: string }) {
  const callback = (params: Record<string, string>) =>
    `/api/gbp/callback?${new URLSearchParams({ state, ...params }).toString()}`;
  return (
    <>
      <p className="bg-accent-soft rounded-lg px-3 py-2 text-sm font-medium">
        Test mode — Google hasn&apos;t approved our API access yet, so this connects a realistic{" "}
        <strong>sample profile</strong>. Once approved, this step is Google&apos;s own sign-in page.
      </p>
      <h1 className="text-xl font-bold">Allow {brand.name} to manage your Business Profile?</h1>
      <ul className="text-ink-muted list-disc pl-5 text-sm">
        <li>See and manage your Business Profile, photos and reviews</li>
        <li>Posts and review replies are published only after approval</li>
      </ul>
      <a
        href={callback({ code: "sample-owner" })}
        className="bg-primary text-primary-ink rounded-xl px-4 py-3 text-center text-lg font-semibold"
      >
        Allow (sample)
      </a>
      <a
        href={callback({ error: "access_denied" })}
        className="border-line bg-surface rounded-xl border px-4 py-3 text-center"
      >
        Cancel
      </a>
    </>
  );
}

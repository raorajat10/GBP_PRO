import type { Metadata } from "next";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { formatIst } from "@/lib/approvals/format";
import { getInviteByToken } from "@/lib/gbp/invites";
import { InviteShell, Notice } from "../shell";

export const metadata: Metadata = {
  title: "Connect your Google profile",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <InviteShell>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        {params.then(({ token }) => (
          <Invite token={token} />
        ))}
      </Suspense>
    </InviteShell>
  );
}

async function Invite({ token }: { token: string }) {
  const invite = await getInviteByToken(token);
  if (!invite) {
    return (
      <Notice title="This link isn't valid">
        Please use the latest link our team sent you, or ask them for a new one.
      </Notice>
    );
  }
  if (invite.status === "used") {
    return (
      <Notice title="Already connected ✅">
        {invite.businessName}&apos;s Google profile is already connected. Nothing more to do.
      </Notice>
    );
  }
  if (invite.status !== "pending") {
    return (
      <Notice
        title={invite.status === "cancelled" ? "This link was withdrawn" : "This link has expired"}
      >
        Please ask our team to send you a new one.
      </Notice>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold">Connect {invite.businessName}&apos;s Google profile</h1>
      <p className="text-ink-muted">
        Our team will look after your listing on Google Search and Maps. To do that, please approve
        access with the Google account that owns your Business Profile.
      </p>

      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4 text-sm">
        <div>
          <p className="font-semibold">{brand.name} will be able to:</p>
          <ul className="text-ink-muted mt-1 list-disc pl-5">
            <li>See your profile details, photos, reviews and visitor numbers</li>
            <li>Suggest fixes to your profile and report your progress every week</li>
            <li>Publish posts and reply to reviews — only after they&apos;re approved</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">We will never:</p>
          <ul className="text-ink-muted mt-1 list-disc pl-5">
            <li>Post anything without your approval</li>
            <li>Write fake reviews, or change your phone number, address or name</li>
            <li>Ask for your Google password — you sign in on Google&apos;s own page</li>
          </ul>
        </div>
        <p className="text-ink-muted">
          You can remove our access at any time from your Business Profile settings.
        </p>
      </section>

      <a
        href={`/api/gbp/invite?token=${encodeURIComponent(token)}`}
        className="bg-primary text-primary-ink rounded-xl px-4 py-3 text-center text-lg font-semibold"
      >
        Continue with Google
      </a>
      <p className="text-ink-muted text-xs">
        This private link works once and expires on {formatIst(new Date(invite.expiresAt))}.
      </p>
    </>
  );
}

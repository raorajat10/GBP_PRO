import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteShell, Notice } from "../shell";

export const metadata: Metadata = {
  title: "Google profile connection",
  robots: { index: false, follow: false },
};

const RESULTS: Record<string, { title: string; text: string; tone?: "success" | "error" }> = {
  linked: {
    title: "Connected ✅",
    text: "Thank you! Your Google profile is now connected. Our team will take it from here, and you'll approve every post before it goes live.",
    tone: "success",
  },
  connected: {
    title: "Connected ✅",
    text: "Thank you! Your Google account manages more than one profile, so our team will pick the right one and contact you if anything is unclear.",
    tone: "success",
  },
  cancelled: {
    title: "Not connected",
    text: "You cancelled, so nothing was changed. You can open the link from our message again whenever you're ready.",
  },
  "no-profiles": {
    title: "No Business Profile found",
    text: "That Google account doesn't manage a Business Profile. Please try again with the account that owns your listing, or ask our team for help.",
    tone: "error",
  },
  used: {
    title: "Link already used",
    text: "This link has already been used. If your profile isn't connected yet, ask our team for a new link.",
  },
  expired: {
    title: "This link has expired",
    text: "Please ask our team for a new link.",
    tone: "error",
  },
  cancelled_invite: {
    title: "This link was withdrawn",
    text: "Please ask our team for a new link.",
  },
  invalid: {
    title: "This link isn't valid",
    text: "Please use the latest link our team sent you.",
  },
  error: {
    title: "Something went wrong",
    text: "Nothing was changed. Please try the link again in a few minutes, or contact our team.",
    tone: "error",
  },
};

export default function InviteDonePage({ searchParams }: PageProps<"/invite/done">) {
  return (
    <InviteShell>
      <Suspense fallback={null}>
        {searchParams.then((sp) => {
          const key = typeof sp.status === "string" ? sp.status : "error";
          const r = RESULTS[key] ?? RESULTS.error;
          return (
            <Notice title={r.title} tone={r.tone}>
              {r.text}
            </Notice>
          );
        })}
      </Suspense>
    </InviteShell>
  );
}

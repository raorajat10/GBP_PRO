import type { Metadata } from "next";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { formatIst, getApprovalByToken, type ApprovalView } from "@/lib/approvals/service";
import { CTA_TYPES } from "@/lib/posts/rules";
import { answerAction } from "./actions";
import { AnswerForm } from "./answer-form";

export const metadata: Metadata = {
  title: "Approve post",
  // The link is private: keep it out of search engines and link previews' referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ApprovePage({ params }: PageProps<"/approve/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
      <p className="text-primary text-sm font-semibold">{brand.name}</p>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        {params.then(({ token }) => (
          <Approval token={token} />
        ))}
      </Suspense>
    </main>
  );
}

async function Approval({ token }: { token: string }) {
  const a = await getApprovalByToken(token);
  if (!a) {
    return (
      <Notice title="This link isn't valid">
        It may have been typed wrongly, or replaced by a newer link. Please use the latest message
        from our team.
      </Notice>
    );
  }
  return (
    <>
      <h1 className="text-xl font-bold">New Google post for {a.businessName}</h1>
      <PostPreview a={a} />
      <Outcome a={a} token={token} />
    </>
  );
}

function PostPreview({ a }: { a: ApprovalView }) {
  const cta = CTA_TYPES.find((c) => c.value === a.ctaType);
  return (
    <article className="border-line bg-surface overflow-hidden rounded-2xl border">
      {a.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={a.photoUrl} alt="Photo for the post" className="w-full object-cover" />
      )}
      <div className="flex flex-col gap-3 p-4">
        <p className="whitespace-pre-line">{a.body}</p>
        {cta && <p className="text-primary text-sm font-semibold">Button: {cta.label}</p>}
        <p className="text-ink-muted text-sm">
          Goes live:{" "}
          {a.scheduledFor ? formatIst(new Date(a.scheduledFor)) : "as soon as you approve"}
        </p>
      </div>
    </article>
  );
}

function Outcome({ a, token }: { a: ApprovalView; token: string }) {
  switch (a.status) {
    case "pending":
      return (
        <AnswerForm
          action={answerAction.bind(null, token)}
          expiresText={formatIst(new Date(a.expiresAt))}
        />
      );
    case "approved":
      return (
        <Notice title="Approved ✅" tone="success">
          Thank you! The post will go live
          {a.scheduledFor ? ` on ${formatIst(new Date(a.scheduledFor))}` : " shortly"}.
        </Notice>
      );
    case "changes_requested":
      return (
        <Notice title="Change requested ✏️">
          Our team will update the post and send it to you again.
          {a.responseNote && <span className="mt-2 block italic">“{a.responseNote}”</span>}
        </Notice>
      );
    case "expired":
      return (
        <Notice title="This request has expired">
          Nothing was posted. Our team will get in touch and send it again if needed.
        </Notice>
      );
    default:
      return (
        <Notice title="This request was withdrawn">
          Our team replaced or cancelled it. Nothing was posted.
        </Notice>
      );
  }
}

function Notice({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "success";
  children: React.ReactNode;
}) {
  return (
    <section
      role="status"
      className={`rounded-2xl border p-4 ${tone === "success" ? "border-success bg-primary-soft" : "border-line bg-surface"}`}
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="text-ink-muted mt-1 text-sm">{children}</p>
    </section>
  );
}

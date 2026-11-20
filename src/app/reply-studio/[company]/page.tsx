import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReplyForm } from "@/app/(app)/reply-studio/reply-form";
import { getPublicReplyStudioClient } from "@/lib/clients/public";
import { createPublicReplyDrafts } from "./actions";

export const metadata: Metadata = {
  title: "Reply studio",
  robots: { index: false, follow: false },
};

/**
 * Public (no login) reply studio for one client, e.g. /reply-studio/sarvatra-energy.
 * Exists automatically for every active client; the link name is set on the client page.
 */
export default function PublicReplyStudioPage({ params }: PageProps<"/reply-studio/[company]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        {params.then(({ company }) => (
          <Studio slug={company} />
        ))}
      </Suspense>
    </main>
  );
}

async function Studio({ slug }: { slug: string }) {
  const company = await getPublicReplyStudioClient(slug);
  if (!company) notFound();
  return (
    <>
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">
          {company.name} · Review replies
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Reply studio</h1>
        <p className="text-ink-muted mt-2">
          Turn a customer review into a thoughtful owner response. Choose a draft, make it yours,
          and paste it into Google.
        </p>
      </div>
      <ReplyForm action={createPublicReplyDrafts} company={company} />
    </>
  );
}

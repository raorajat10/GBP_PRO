import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicClient } from "@/lib/clients/public";
import { ReviewFlow } from "./review-flow";

export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};

/**
 * Public (no login) page that helps a customer write THEIR OWN Google review, e.g.
 * /review/sarvtra. Exists automatically for every active client.
 */
export default function ReviewPage({ params }: PageProps<"/review/[company]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        {params.then(({ company }) => (
          <Review slug={company} />
        ))}
      </Suspense>
    </main>
  );
}

async function Review({ slug }: { slug: string }) {
  const client = await getPublicClient(slug);
  if (!client) notFound();
  return (
    <>
      <div>
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">{client.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">How was your experience?</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Your honest words help other customers and help us improve. It takes a minute.
        </p>
      </div>
      <ReviewFlow company={{ slug: client.slug, name: client.name }} reviewUrl={client.reviewUrl} />
    </>
  );
}

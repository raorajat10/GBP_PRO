import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { ListSkeleton } from "@/components/skeleton";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Reply studio" };

// The login check reads cookies, so it must sit inside <Suspense> (Next 16 Cache Components),
// like every other signed-in page.
export default function ReplyStudioPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <ReplyStudio />
    </Suspense>
  );
}

async function ReplyStudio() {
  await requireUser(["admin", "manager"]);
  return (
    <>
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">Review replies</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Reply studio</h1>
        <p className="text-ink-muted mt-2">
          Turn a customer review into a thoughtful owner response. Choose a draft, make it yours,
          and paste it into Google.
        </p>
      </div>
      <ReplyForm />
    </>
  );
}

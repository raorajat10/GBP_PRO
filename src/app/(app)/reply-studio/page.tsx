import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Reply studio" };

export default async function ReplyStudioPage() {
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

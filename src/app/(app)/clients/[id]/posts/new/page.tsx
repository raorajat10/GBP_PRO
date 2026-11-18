import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { aiWritingEnabled } from "@/lib/audit/service";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { createPostAction } from "../../../post-actions";
import { NewPostForm } from "./new-post-form";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage({ params }: PageProps<"/clients/[id]/posts/new">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      {params.then(({ id }) => (
        <NewPost clientId={id} />
      ))}
    </Suspense>
  );
}

async function NewPost({ clientId }: { clientId: string }) {
  await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, preferred_language, locations(id)")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  return (
    <>
      <Link
        href={`/clients/${clientId}/posts`}
        className="text-ink-muted hover:text-primary w-fit text-sm"
      >
        ← Posts
      </Link>
      <h1 className="text-2xl font-bold">New post for {client.business_name}</h1>
      {client.locations.length === 0 && (
        <p className="bg-accent-soft rounded-lg px-3 py-2 text-sm">
          This client&apos;s Google profile isn&apos;t linked yet. You can write drafts now, but
          they can&apos;t be published until the profile is linked.
        </p>
      )}
      {!aiWritingEnabled() && (
        <p className="bg-accent-soft rounded-lg px-3 py-2 text-sm">
          No Anthropic API key is set, so drafts are simple samples made from your note. Add
          ANTHROPIC_API_KEY to get real AI drafts that also describe the photo.
        </p>
      )}
      <NewPostForm
        action={createPostAction.bind(null, clientId)}
        defaultLanguage={client.preferred_language ?? "en"}
      />
    </>
  );
}

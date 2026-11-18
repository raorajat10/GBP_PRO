import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { listPosts } from "@/lib/posts/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { LANGUAGE_SHORT, PostStatusChip, SampleBadge } from "@/components/post-status-chip";

export const metadata: Metadata = { title: "Posts" };

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default function PostsPage({ params }: PageProps<"/clients/[id]/posts">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      {params.then(({ id }) => (
        <PostList clientId={id} />
      ))}
    </Suspense>
  );
}

async function PostList({ clientId }: { clientId: string }) {
  await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();
  const posts = await listPosts(clientId);

  return (
    <>
      <Link
        href={`/clients/${clientId}`}
        className="text-ink-muted hover:text-primary w-fit text-sm"
      >
        ← {client.business_name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Link
          href={`/clients/${clientId}/posts/new`}
          className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="border-line bg-surface text-ink-muted rounded-2xl border border-dashed p-8 text-center">
          No posts yet. Click “New post”, add a photo and a short note, and get three drafts to
          choose from.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/clients/${clientId}/posts/${p.id}`}
                className="border-line bg-surface hover:border-primary flex items-center gap-3 rounded-xl border p-3"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img
                    src={p.photoUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="bg-paper border-line size-16 shrink-0 rounded-lg border" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="line-clamp-2 text-sm">{p.body || "—"}</p>
                  <p className="text-ink-muted flex flex-wrap items-center gap-2 text-xs">
                    <PostStatusChip status={p.status} />
                    <span>{LANGUAGE_SHORT[p.language] ?? p.language}</span>
                    {p.scheduledFor && <span>for {when.format(new Date(p.scheduledFor))}</span>}
                    {p.aiModel === "sample" && <SampleBadge />}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

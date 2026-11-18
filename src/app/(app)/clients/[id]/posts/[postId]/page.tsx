import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { LANGUAGES } from "@/lib/clients/schema";
import { getPost } from "@/lib/posts/service";
import { earliestScheduleIstLocal, isEditable, toIstLocal } from "@/lib/posts/rules";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/components/form-field";
import { ListSkeleton } from "@/components/skeleton";
import { PostStatusChip, SampleBadge } from "@/components/post-status-chip";
import { deletePostAction, regenerateDraftsAction, savePostAction } from "../../../post-actions";
import { PostEditor } from "./post-editor";
import { ApprovalPanel } from "./approval-panel";

export const metadata: Metadata = { title: "Edit post" };

export default function PostPage({ params }: PageProps<"/clients/[id]/posts/[postId]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      {params.then(({ id, postId }) => (
        <Post clientId={id} postId={postId} />
      ))}
    </Suspense>
  );
}

async function Post({ clientId, postId }: { clientId: string; postId: string }) {
  await requireUser(["admin", "manager"]);
  if (!z.uuid().safeParse(clientId).success || !z.uuid().safeParse(postId).success) notFound();
  const post = await getPost(postId);
  // Row-level security already hides other managers' posts; this also checks the URL matches.
  if (!post || post.clientId !== clientId) notFound();
  const editable = isEditable(post.status);

  return (
    <>
      <Link
        href={`/clients/${clientId}/posts`}
        className="text-ink-muted hover:text-primary w-fit text-sm"
      >
        ← Posts
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Post</h1>
        <PostStatusChip status={post.status} />
        {post.aiModel === "sample" && <SampleBadge />}
      </div>
      <p className="text-ink-muted text-sm">
        Note: <span className="text-ink">{post.sourceNote}</span>
      </p>
      {!post.locationLinked && (
        <p className="bg-accent-soft rounded-lg px-3 py-2 text-sm">
          Link this client&apos;s Google profile before this post can be published.
        </p>
      )}

      <PostEditor
        // New drafts (another language, or a rewrite) start the editor fresh; a save doesn't.
        key={`${post.language}:${post.drafts.map((d) => d.body).join("\u0000")}`}
        action={savePostAction.bind(null, clientId, postId)}
        editable={editable}
        photoUrl={post.photoUrl}
        drafts={post.drafts}
        defaults={{
          body: post.body,
          ctaType: post.ctaType ?? "",
          ctaUrl: post.ctaUrl ?? (post.website?.startsWith("https://") ? post.website : ""),
          scheduledFor: post.scheduledFor ? toIstLocal(new Date(post.scheduledFor)) : "",
        }}
        minTime={earliestScheduleIstLocal()}
      />

      <ApprovalPanel clientId={clientId} postId={postId} status={post.status} />

      {editable && (
        <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">More</h2>
          <ActionForm
            action={regenerateDraftsAction.bind(null, clientId, postId)}
            label="Write new drafts"
            pendingLabel="Writing… (up to a minute)"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Language</span>
              <select name="language" defaultValue={post.language} className={inputClass}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
          <p className="text-ink-muted text-xs">
            New drafts replace the three above and your current text. Save first if you want to keep
            an edit.
          </p>
          <div className="border-line border-t pt-4">
            <ActionForm
              action={deletePostAction.bind(null, clientId, postId)}
              label="Delete draft"
              pendingLabel="Deleting…"
              variant="danger"
              confirm="Delete this draft and its photo?"
            />
          </div>
        </section>
      )}
    </>
  );
}

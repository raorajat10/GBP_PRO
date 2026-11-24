import { formatIst } from "@/lib/approvals/service";
import { MAX_PUBLISH_ATTEMPTS } from "@/lib/posts/publish-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { publishNowAction } from "../../../publish-actions";

/** Where an approved post stands with Google, and a way to publish or retry it now. */
export async function PublishPanel({ clientId, postId }: { clientId: string; postId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("status, scheduled_for, published_at, publish_attempts, error, gbp_post_name")
    .eq("id", postId)
    .single();
  if (!post || !["scheduled", "publishing", "published", "failed"].includes(post.status)) {
    return null;
  }

  return (
    <section
      aria-labelledby="publish-heading"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5"
    >
      <h2 id="publish-heading" className="text-lg font-semibold">
        Publishing on Google
      </h2>
      {post.status === "published" && (
        <p className="text-sm">
          Live on Google since{" "}
          <span className="font-semibold">{formatIst(new Date(post.published_at!))}</span>.
        </p>
      )}
      {post.status === "publishing" && <p className="text-sm">Sending to Google now…</p>}
      {post.status === "scheduled" && (
        <p className="text-sm">
          Goes live{" "}
          <span className="font-semibold">
            {post.scheduled_for ? formatIst(new Date(post.scheduled_for)) : "as soon as possible"}
          </span>
          .
          {post.publish_attempts > 0 && (
            <>
              {" "}
              Try {post.publish_attempts + 1} of {MAX_PUBLISH_ATTEMPTS} after: {post.error}
            </>
          )}
        </p>
      )}
      {post.status === "failed" && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
          Not published after {post.publish_attempts}{" "}
          {post.publish_attempts === 1 ? "try" : "tries"}: {post.error ?? "unknown error"}
        </p>
      )}
      {(post.status === "scheduled" || post.status === "failed") && (
        <ActionForm
          action={publishNowAction.bind(null, clientId, postId)}
          label={post.status === "failed" ? "Try again now" : "Publish now"}
          pendingLabel="Publishing…"
          variant="primary"
        />
      )}
    </section>
  );
}

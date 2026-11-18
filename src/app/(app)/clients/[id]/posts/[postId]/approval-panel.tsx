import { formatIst, latestApproval } from "@/lib/approvals/service";
import { isEditable } from "@/lib/posts/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelApprovalAction, sendForApprovalAction } from "../../../approval-actions";
import { CancelForm, SendForm } from "./approval-forms";

/** Caller must already have checked the user can manage this client. */
export async function ApprovalPanel({
  clientId,
  postId,
  status,
}: {
  clientId: string;
  postId: string;
  status: string;
}) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, latest] = await Promise.all([
    supabase
      .from("clients")
      .select("owner_name, owner_whatsapp, whatsapp_opt_in_at")
      .eq("id", clientId)
      .single(),
    latestApproval(postId),
  ]);
  const whatsappReady = Boolean(client?.owner_whatsapp && client.whatsapp_opt_in_at);
  const owner = client?.owner_name || "the owner";

  return (
    <section
      aria-labelledby="approval-heading"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5"
    >
      <h2 id="approval-heading" className="text-lg font-semibold">
        Owner approval
      </h2>

      {latest?.status === "changes_requested" && (
        <div className="bg-accent-soft rounded-lg p-3 text-sm">
          <p className="font-semibold">
            {owner} asked for changes
            {latest.respondedAt && ` (${formatIst(new Date(latest.respondedAt))})`}:
          </p>
          <p className="mt-1 whitespace-pre-line">
            {latest.responseNote ??
              (latest.respondedVia === "whatsapp"
                ? "They tapped “Request change” on WhatsApp. Their note will appear here when they reply."
                : "No note given.")}
          </p>
        </div>
      )}
      {latest?.status === "expired" && status === "expired" && (
        <p className="bg-accent-soft rounded-lg p-3 text-sm">
          {owner} didn&apos;t answer within 72 hours, so the request expired. Nothing was posted.
          Call them, then send it again.
        </p>
      )}

      {status === "pending_approval" && latest?.status === "pending" && (
        <>
          <p className="text-sm">
            Waiting for {owner}. Sent {formatIst(new Date(latest.createdAt))}
            {latest.channel === "whatsapp" ? " on WhatsApp" : " as a link"}, open until{" "}
            {formatIst(new Date(latest.expiresAt))}.
          </p>
          {latest.channel === "whatsapp" && (
            <p className="text-ink-muted text-sm">
              WhatsApp: {latest.whatsappStatus ?? "—"}
              {latest.whatsappError && ` (${latest.whatsappError})`}
            </p>
          )}
          <CancelForm action={cancelApprovalAction.bind(null, clientId, postId)} />
          <p className="text-ink-muted text-xs">
            Lost the link? Cancel and send again to get a new one.
          </p>
        </>
      )}

      {(status === "scheduled" || status === "publishing" || status === "published") &&
        latest?.status === "approved" && (
          <p className="text-success text-sm font-medium">
            Approved by {owner}
            {latest.respondedVia === "whatsapp" ? " on WhatsApp" : " via the link"}
            {latest.respondedAt && `, ${formatIst(new Date(latest.respondedAt))}`}. It can no longer
            be edited.
          </p>
        )}

      {isEditable(status) && (
        <>
          <p className="text-ink-muted text-sm">
            {whatsappReady
              ? `${owner} gets the post on WhatsApp with Approve and Request change buttons, plus a link.`
              : `${owner} hasn't agreed to WhatsApp messages (or has no number), so you'll get a link to send them yourself.`}{" "}
            Save your changes first.
          </p>
          <SendForm
            action={sendForApprovalAction.bind(null, clientId, postId)}
            label={status === "draft" ? "Send for approval" : "Send again"}
          />
        </>
      )}
    </section>
  );
}

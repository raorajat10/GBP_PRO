import "server-only";
import { brand } from "@/config/brand";
import { formatIst } from "@/lib/approvals/format";
import { hashApprovalToken, looksLikeApprovalToken, newApprovalToken } from "@/lib/approvals/token";
import { emailEnabled, EmailError, escapeHtml, sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Owner connect invites: a private link the team sends to a business owner, who signs in
 * with Google and approves access to their Business Profile. The link (single use,
 * 7 days) is the permission, so only its hash is stored.
 */

export const INVITE_DAYS = 7;
const DAY = 86_400_000;

export class InviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteError";
  }
}

export const inviteUrl = (appUrl: string, token: string) =>
  new URL(`/invite/${token}`, appUrl).toString();

export interface CreatedInvite {
  link: string;
  emailStatus: "not_sent" | "sent" | "failed";
  emailError: string | null;
}

export async function createInvite(input: {
  clientId: string;
  userId: string;
  email: string | null;
  appUrl: string;
  now?: Date;
}): Promise<CreatedInvite> {
  const admin = createSupabaseAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("business_name, owner_name")
    .eq("id", input.clientId)
    .single();
  if (!client) throw new InviteError("Client not found.");

  const token = newApprovalToken();
  const link = inviteUrl(input.appUrl, token);
  const expiresAt = new Date((input.now ?? new Date()).getTime() + INVITE_DAYS * DAY);
  const { data: invite, error } = await admin
    .from("connect_invites")
    .insert({
      client_id: input.clientId,
      token_hash: hashApprovalToken(token),
      sent_to_email: input.email,
      expires_at: expiresAt.toISOString(),
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !invite) throw new InviteError("Couldn't create the invite. Try again.");

  let emailStatus: CreatedInvite["emailStatus"] = "not_sent";
  let emailError: string | null = null;
  if (input.email) {
    if (!emailEnabled()) {
      emailError = "Email isn't set up yet, so send the link yourself.";
    } else {
      try {
        await sendEmail(inviteEmail({ ...client, to: input.email, link, expiresAt }));
        emailStatus = "sent";
      } catch (e) {
        emailStatus = "failed";
        emailError = e instanceof EmailError ? e.message : "The email couldn't be sent.";
      }
    }
    await admin.from("connect_invites").update({ email_status: emailStatus }).eq("id", invite.id);
  }
  return { link, emailStatus, emailError };
}

function inviteEmail(x: {
  to: string;
  business_name: string;
  owner_name: string | null;
  link: string;
  expiresAt: Date;
}) {
  const hello = x.owner_name ? `Namaste ${x.owner_name},` : "Namaste,";
  const subject = `Connect ${x.business_name}'s Google Business Profile to ${brand.name}`;
  const lines = [
    hello,
    "",
    `To start managing ${x.business_name}'s Google Business Profile (your listing on Google Search and Maps), please approve access using this private link:`,
    x.link,
    "",
    "You'll sign in with the Google account that owns the profile and see exactly what access is asked for.",
    "Nothing is ever posted without your approval, and you can remove our access at any time from your Business Profile settings.",
    "",
    `This link works once and expires on ${formatIst(x.expiresAt)}.`,
    "If you weren't expecting this, you can ignore this email.",
  ];
  const html = `<p>${escapeHtml(hello)}</p>
<p>To start managing <strong>${escapeHtml(x.business_name)}</strong>'s Google Business Profile (your listing on Google Search and Maps), please approve access:</p>
<p><a href="${escapeHtml(x.link)}" style="display:inline-block;background:#0f6e5c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Approve access to my Google profile</a></p>
<p>You'll sign in with the Google account that owns the profile and see exactly what access is asked for. Nothing is ever posted without your approval, and you can remove our access at any time from your Business Profile settings.</p>
<p style="color:#5a6573;font-size:13px">This link works once and expires on ${escapeHtml(formatIst(x.expiresAt))}. If you weren't expecting this, you can ignore this email.</p>`;
  return { to: x.to, subject, text: lines.join("\n"), html };
}

export interface InviteView {
  id: string;
  clientId: string;
  businessName: string;
  status: "pending" | "used" | "cancelled" | "expired";
  expiresAt: string;
}

export async function getInviteByToken(token: string): Promise<InviteView | null> {
  if (!looksLikeApprovalToken(token)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("connect_invites")
    .select("id, client_id, status, expires_at, client:clients(business_name)")
    .eq("token_hash", hashApprovalToken(token))
    .maybeSingle();
  if (!data?.client) return null;
  const expired = data.status === "pending" && Date.parse(data.expires_at) <= Date.now();
  return {
    id: data.id,
    clientId: data.client_id,
    businessName: data.client.business_name,
    status: expired ? "expired" : (data.status as InviteView["status"]),
    expiresAt: data.expires_at,
  };
}

/**
 * Use up an invite (at the end of Google's consent). Returns its client, or null if the
 * invite was already used, cancelled or expired. Single statement, so two tabs racing
 * can't both claim it.
 */
export async function claimInvite(inviteId: string): Promise<{ clientId: string } | null> {
  const { data } = await createSupabaseAdminClient()
    .from("connect_invites")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("client_id")
    .maybeSingle();
  return data ? { clientId: data.client_id } : null;
}

export async function recordInviteConnection(inviteId: string, connectionId: string) {
  await createSupabaseAdminClient()
    .from("connect_invites")
    .update({ connection_id: connectionId })
    .eq("id", inviteId);
}

/** Caller must have checked the user can manage this client. */
export async function cancelInvite(inviteId: string, clientId: string): Promise<void> {
  const { data } = await createSupabaseAdminClient()
    .from("connect_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .select("id");
  if (!data?.length) throw new InviteError("That invite is no longer open.");
}

export interface InviteListItem {
  id: string;
  sentToEmail: string | null;
  emailStatus: string;
  status: "pending" | "used" | "cancelled" | "expired";
  expiresAt: string;
  createdAt: string;
}

/** Recent invites for a client, read as the signed-in team member (row-level security). */
export async function listInvites(clientId: string): Promise<InviteListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("connect_invites")
    .select("id, sent_to_email, email_status, status, expires_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((i) => ({
    id: i.id,
    sentToEmail: i.sent_to_email,
    emailStatus: i.email_status,
    status:
      i.status === "pending" && Date.parse(i.expires_at) <= Date.now()
        ? "expired"
        : (i.status as InviteListItem["status"]),
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

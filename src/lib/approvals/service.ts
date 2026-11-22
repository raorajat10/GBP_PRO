import "server-only";
import { serverEnv } from "@/lib/env";
import { getMessagingProvider } from "@/lib/messaging/provider";
import {
  MessagingError,
  parseButtonPayload,
  toE164,
  type InboundEvent,
  type MessagingProvider,
} from "@/lib/messaging/types";
import { postIssues } from "@/lib/posts/rules";
import type { Json } from "@/lib/supabase/database.types";
import { notifyClient } from "@/lib/notifications/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  APPROVAL_EXPIRY_HOURS,
  APPROVAL_REMINDER_HOURS,
  approvalUrl,
  hashApprovalToken,
  looksLikeApprovalToken,
  newApprovalToken,
} from "./token";
import { formatIst, previewOf } from "./format";

export { formatIst } from "./format";

/**
 * Client approvals for posts (docs/PLAN.md §2.3). Uses the secret-key client, so callers
 * must check permissions first — except the token and webhook paths, where the token or
 * the verified WhatsApp sender IS the permission.
 */

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

const HOUR = 3_600_000;
const PHOTO_LINK_SECONDS = 24 * 60 * 60; // WhatsApp fetches the image when delivering

const waLanguage = (lang: string | null): "en" | "hi" => (lang === "hi" ? "hi" : "en");

async function logMessage(row: {
  client_id: string | null;
  direction: "out" | "in";
  provider: "mock" | "meta";
  to_number?: string | null;
  from_number?: string | null;
  template_name?: string | null;
  body?: string | null;
  payload?: Record<string, unknown>;
  provider_message_id?: string | null;
  status: "sent" | "failed" | "received";
  error?: string | null;
}) {
  const { error } = await createSupabaseAdminClient()
    .from("messages")
    .insert({ ...row, payload: (row.payload ?? {}) as Json });
  // A duplicate provider id means Meta delivered the same webhook twice: fine to ignore.
  if (error && error.code !== "23505") console.error("Logging a message failed", error);
}

// ───────────── team: send / cancel ─────────────

export interface SendResult {
  link: string;
  channel: "whatsapp" | "web";
  whatsappError: string | null;
  expiresAt: string;
}

export async function sendPostForApproval(input: {
  postId: string;
  userId: string;
  messaging?: MessagingProvider;
  now?: Date;
}): Promise<SendResult> {
  const admin = createSupabaseAdminClient();
  const now = input.now ?? new Date();
  const { data: post } = await admin
    .from("posts")
    .select(
      "id, status, body, scheduled_for, media:media_assets(storage_path), client:clients(id, business_name, owner_name, owner_whatsapp, whatsapp_opt_in_at, preferred_language)",
    )
    .eq("id", input.postId)
    .maybeSingle();
  if (!post?.client) throw new ApprovalError("Post not found.");
  if (!["draft", "changes_requested", "expired"].includes(post.status)) {
    throw new ApprovalError("This post has already been sent.");
  }
  if (postIssues(post.body).length) {
    throw new ApprovalError("Fix the post text before sending it (see the warnings above).");
  }
  if (post.scheduled_for && Date.parse(post.scheduled_for) < now.getTime()) {
    throw new ApprovalError("The publish time has passed. Pick a new time and save first.");
  }

  const client = post.client;
  const token = newApprovalToken();
  const link = approvalUrl(serverEnv().APP_URL, token);
  const viaWhatsApp = Boolean(client.owner_whatsapp && client.whatsapp_opt_in_at);
  const expiresAt = new Date(now.getTime() + APPROVAL_EXPIRY_HOURS * HOUR);

  const { data: approvalId, error } = await admin.rpc("open_post_approval", {
    p_post_id: post.id,
    p_token_hash: hashApprovalToken(token),
    p_channel: viaWhatsApp ? "whatsapp" : "web",
    p_expires_at: expiresAt.toISOString(),
    p_sent_by: input.userId,
  });
  if (error || !approvalId) {
    if (error?.code === "23505")
      throw new ApprovalError("This post is already waiting for approval.");
    throw new ApprovalError("Couldn't send the post for approval. Try again.");
  }

  // The approval link itself carries the token, so it is never stored in notifications.
  await notifyClient({
    clientId: client.id,
    kind: "approval",
    title: "A post is waiting for your approval",
    body: viaWhatsApp
      ? "Open the WhatsApp message from our team to approve it or ask for changes."
      : "Open the approval link our team sent you to approve it or ask for changes.",
    link: "/home/grow/posts",
  });

  let whatsappError: string | null = null;
  if (viaWhatsApp) {
    let messaging: MessagingProvider | undefined = input.messaging;
    const language = waLanguage(client.preferred_language);
    const goLive = post.scheduled_for
      ? `on ${formatIst(new Date(post.scheduled_for))}`
      : language === "hi"
        ? "आपकी मंज़ूरी के तुरंत बाद"
        : "as soon as you approve";
    let photoUrl: string | null = null;
    if (post.media) {
      const { data } = await admin.storage
        .from("media")
        .createSignedUrl(post.media.storage_path, PHOTO_LINK_SECONDS);
      photoUrl = data?.signedUrl ?? null;
    }
    const msg = {
      to: client.owner_whatsapp!,
      language,
      ownerName: client.owner_name?.trim() || (language === "hi" ? "जी" : "there"),
      businessName: client.business_name,
      postPreview: previewOf(post.body),
      goLiveText: goLive,
      approvalLink: link,
      photoUrl,
      approvalId,
    };
    try {
      messaging ??= getMessagingProvider();
      const sent = await messaging.sendApprovalRequest(msg);
      await admin
        .from("approvals")
        .update({ wa_message_id: sent.providerMessageId })
        .eq("id", approvalId);
      await logMessage({
        client_id: client.id,
        direction: "out",
        provider: messaging.kind,
        to_number: msg.to,
        template_name: serverEnv().WA_TEMPLATE_APPROVAL,
        body: msg.postPreview,
        // Never log the link: it carries the token.
        payload: { approvalId, postId: post.id, language },
        provider_message_id: sent.providerMessageId,
        status: "sent",
      });
    } catch (e) {
      whatsappError = e instanceof MessagingError ? e.message : "WhatsApp couldn't be sent.";
      await logMessage({
        client_id: client.id,
        direction: "out",
        provider: messaging?.kind ?? serverEnv().MESSAGING_PROVIDER,
        to_number: msg.to,
        template_name: serverEnv().WA_TEMPLATE_APPROVAL,
        payload: { approvalId, postId: post.id },
        status: "failed",
        error: whatsappError,
      });
    }
  }
  return {
    link,
    channel: viaWhatsApp ? "whatsapp" : "web",
    whatsappError,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function cancelApproval(postId: string): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().rpc("cancel_post_approval", {
    p_post_id: postId,
  });
  if (error) throw new ApprovalError("Couldn't cancel the request.");
  if (!data) throw new ApprovalError("There's no open request to cancel.");
}

// ───────────── owner: the link page ─────────────

export interface ApprovalView {
  approvalId: string;
  status: "pending" | "approved" | "changes_requested" | "expired" | "cancelled";
  expiresAt: string;
  respondedAt: string | null;
  responseNote: string | null;
  businessName: string;
  body: string;
  ctaType: string | null;
  scheduledFor: string | null;
  photoUrl: string | null;
}

async function approvalIdForToken(token: string): Promise<string | null> {
  if (!looksLikeApprovalToken(token)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("approvals")
    .select("id")
    .eq("token_hash", hashApprovalToken(token))
    .maybeSingle();
  return data?.id ?? null;
}

export async function getApprovalByToken(token: string): Promise<ApprovalView | null> {
  const id = await approvalIdForToken(token);
  if (!id) return null;
  const admin = createSupabaseAdminClient();
  const { data: a } = await admin
    .from("approvals")
    .select(
      "id, status, expires_at, responded_at, response_note, post:posts(body, cta_type, scheduled_for, media:media_assets(storage_path)), client:clients(business_name)",
    )
    .eq("id", id)
    .single();
  if (!a?.post || !a.client) return null;
  let photoUrl: string | null = null;
  if (a.post.media) {
    const { data } = await admin.storage
      .from("media")
      .createSignedUrl(a.post.media.storage_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  const expired = a.status === "pending" && Date.parse(a.expires_at) <= Date.now();
  return {
    approvalId: a.id,
    status: (expired ? "expired" : a.status) as ApprovalView["status"],
    expiresAt: a.expires_at,
    respondedAt: a.responded_at,
    responseNote: a.response_note,
    businessName: a.client.business_name,
    body: a.post.body,
    ctaType: a.post.cta_type,
    scheduledFor: a.post.scheduled_for,
    photoUrl,
  };
}

/** Returns the resulting status; "pending" never comes back. */
export async function respondByToken(
  token: string,
  decision: "approved" | "changes_requested",
  note: string | null,
): Promise<string> {
  const id = await approvalIdForToken(token);
  if (!id) throw new ApprovalError("This link isn't valid.");
  return respond(id, decision, note, "web");
}

async function respond(
  approvalId: string,
  decision: "approved" | "changes_requested",
  note: string | null,
  via: "web" | "whatsapp",
): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().rpc("respond_to_post_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_note: note?.slice(0, 1000) ?? "",
    p_via: via,
  });
  if (error || !data) throw new ApprovalError("Couldn't save your answer. Please try again.");
  return data;
}

// ───────────── WhatsApp webhook ─────────────

const REPLIES = {
  approved: {
    en: "Thank you! The post is approved and will go live as scheduled.",
    hi: "धन्यवाद! पोस्ट मंज़ूर हो गई है और तय समय पर लाइव होगी।",
  },
  changes_requested: {
    en: "Okay. Please reply with what you'd like changed, and our team will update the post.",
    hi: "ठीक है। कृपया बताइए क्या बदलना है, हमारी टीम पोस्ट ठीक कर देगी।",
  },
  closed: {
    en: "This request is no longer open, so nothing was changed. Our team will contact you if needed.",
    hi: "यह अनुरोध अब खुला नहीं है, इसलिए कुछ नहीं बदला। ज़रूरत होने पर हमारी टीम आपसे संपर्क करेगी।",
  },
  noteThanks: {
    en: "Thanks, we've passed this to our team.",
    hi: "धन्यवाद, हमने यह अपनी टीम को भेज दिया है।",
  },
} as const;

/** Handle verified webhook events. Safe to call twice with the same events. */
export async function handleInboundEvents(
  events: InboundEvent[],
  messaging: MessagingProvider = getMessagingProvider(),
): Promise<void> {
  const admin = createSupabaseAdminClient();
  for (const ev of events) {
    try {
      if (ev.type === "status") {
        await admin
          .from("messages")
          .update({ status: ev.status, error: ev.error })
          .eq("provider_message_id", ev.providerMessageId)
          .eq("direction", "out");
        continue;
      }

      const from = toE164(ev.from);
      const { data: clients } = await admin
        .from("clients")
        .select("id, preferred_language")
        .eq("owner_whatsapp", from);
      const clientIds = (clients ?? []).map((c) => c.id);
      const lang = waLanguage(clients?.[0]?.preferred_language ?? null);
      const reply = async (text: string) => {
        const sent = await messaging.sendText(from, text);
        await logMessage({
          client_id: clientIds[0] ?? null,
          direction: "out",
          provider: messaging.kind,
          to_number: from,
          body: text,
          provider_message_id: sent.providerMessageId,
          status: "sent",
        });
      };

      await logMessage({
        client_id: clientIds[0] ?? null,
        direction: "in",
        provider: messaging.kind,
        from_number: from,
        body: ev.type === "button" ? ev.text : ev.text.slice(0, 2000),
        payload: ev.type === "button" ? { payload: ev.payload } : {},
        provider_message_id: ev.messageId,
        status: "received",
      });

      if (ev.type === "button") {
        const parsed = parseButtonPayload(ev.payload);
        if (!parsed) continue;
        const { data: a } = await admin
          .from("approvals")
          .select("id, client_id")
          .eq("id", parsed.approvalId)
          .maybeSingle();
        // Only the owner's own number may answer for their business.
        if (!a || !clientIds.includes(a.client_id)) continue;
        const result = await respond(a.id, parsed.decision, null, "whatsapp");
        await reply(
          result === "approved"
            ? REPLIES.approved[lang]
            : result === "changes_requested" && parsed.decision === "changes_requested"
              ? REPLIES.changes_requested[lang]
              : REPLIES.closed[lang],
        );
      } else if (clientIds.length) {
        // A text right after "Request change" is the owner's note.
        const since = new Date(Date.now() - 24 * HOUR).toISOString();
        const { data: open } = await admin
          .from("approvals")
          .select("id")
          .in("client_id", clientIds)
          .eq("status", "changes_requested")
          .eq("responded_via", "whatsapp")
          .is("response_note", null)
          .gte("responded_at", since)
          .order("responded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!open) continue;
        await admin
          .from("approvals")
          .update({ response_note: ev.text.trim().slice(0, 1000) })
          .eq("id", open.id)
          .is("response_note", null);
        await reply(REPLIES.noteThanks[lang]);
      }
    } catch (e) {
      // One bad event mustn't stop the rest; Meta would retry the whole batch.
      console.error("WhatsApp event failed", e);
    }
  }
}

// ───────────── scheduled: expiry and reminders ─────────────

export async function expireAndRemind(
  messaging: MessagingProvider = getMessagingProvider(),
  now: Date = new Date(),
): Promise<{ expired: number; reminded: number }> {
  const admin = createSupabaseAdminClient();
  const { data: expired, error } = await admin.rpc("expire_post_approvals");
  if (error) throw new ApprovalError("Couldn't expire old requests.");

  const { data: due } = await admin
    .from("approvals")
    .select(
      "id, expires_at, client:clients(id, business_name, owner_whatsapp, whatsapp_opt_in_at, preferred_language)",
    )
    .eq("status", "pending")
    .eq("channel", "whatsapp")
    .is("reminded_at", null)
    .lte("created_at", new Date(now.getTime() - APPROVAL_REMINDER_HOURS * HOUR).toISOString())
    .gt("expires_at", now.toISOString());

  let reminded = 0;
  for (const a of due ?? []) {
    const c = a.client;
    if (!c?.owner_whatsapp || !c.whatsapp_opt_in_at) continue;
    // Claim the reminder first, so two runs can't both send it.
    const { data: claimed } = await admin
      .from("approvals")
      .update({ reminded_at: now.toISOString() })
      .eq("id", a.id)
      .is("reminded_at", null)
      .select("id");
    if (!claimed?.length) continue;
    try {
      const sent = await messaging.sendApprovalReminder({
        to: c.owner_whatsapp,
        language: waLanguage(c.preferred_language),
        businessName: c.business_name,
        expiresText: formatIst(new Date(a.expires_at)),
        approvalId: a.id,
      });
      await logMessage({
        client_id: c.id,
        direction: "out",
        provider: messaging.kind,
        to_number: c.owner_whatsapp,
        template_name: serverEnv().WA_TEMPLATE_REMINDER,
        payload: { approvalId: a.id },
        provider_message_id: sent.providerMessageId,
        status: "sent",
      });
      reminded++;
    } catch (e) {
      await logMessage({
        client_id: c.id,
        direction: "out",
        provider: messaging.kind,
        to_number: c.owner_whatsapp,
        template_name: serverEnv().WA_TEMPLATE_REMINDER,
        payload: { approvalId: a.id },
        status: "failed",
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  return { expired: expired?.length ?? 0, reminded };
}

// ───────────── team: status on the post page ─────────────

export interface ApprovalSummary {
  status: string;
  channel: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  respondedVia: string | null;
  responseNote: string | null;
  whatsappStatus: string | null;
  whatsappError: string | null;
}

/** Latest approval for a post. Caller must have checked access to the post's client. */
export async function latestApproval(postId: string): Promise<ApprovalSummary | null> {
  const admin = createSupabaseAdminClient();
  const { data: a } = await admin
    .from("approvals")
    .select(
      "status, channel, created_at, expires_at, responded_at, responded_via, response_note, wa_message_id",
    )
    .eq("subject_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!a) return null;
  let whatsappStatus: string | null = null;
  let whatsappError: string | null = null;
  if (a.channel === "whatsapp") {
    const { data: m } = a.wa_message_id
      ? await admin
          .from("messages")
          .select("status, error")
          .eq("provider_message_id", a.wa_message_id)
          .maybeSingle()
      : { data: null };
    whatsappStatus = m?.status ?? (a.wa_message_id ? "sent" : "failed");
    whatsappError = m?.error ?? null;
  }
  const expired = a.status === "pending" && Date.parse(a.expires_at) <= Date.now();
  return {
    status: expired ? "expired" : a.status,
    channel: a.channel,
    createdAt: a.created_at,
    expiresAt: a.expires_at,
    respondedAt: a.responded_at,
    respondedVia: a.responded_via,
    responseNote: a.response_note,
    whatsappStatus,
    whatsappError,
  };
}

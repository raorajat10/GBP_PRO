import { createHmac, timingSafeEqual } from "node:crypto";
import {
  approvePayload,
  changePayload,
  MessagingError,
  toWaNumber,
  type ApprovalReminderMessage,
  type ApprovalRequestMessage,
  type InboundEvent,
  type MessagingProvider,
  type SentMessage,
} from "./types";

/**
 * Meta WhatsApp Cloud API (docs/PLAN.md §6.2). Templates must exist and be approved in
 * WhatsApp Manager with the same names, parameters and button order as used here:
 *
 *   post_approval_request (utility; en and hi)
 *     header: IMAGE
 *     body:   {{1}} owner name, {{2}} business, {{3}} when it goes live,
 *             {{4}} post preview, {{5}} link to the full post
 *     buttons: [quick reply "Approve", quick reply "Request change"]
 *
 *   approval_reminder (utility; en and hi)
 *     body:   {{1}} business, {{2}} when the request expires
 *     (no link: only its hash is stored, so the buttons carry the answer)
 *     buttons: [quick reply "Approve", quick reply "Request change"]
 */
export class MetaCloudWhatsApp implements MessagingProvider {
  readonly kind = "meta" as const;

  constructor(
    private readonly cfg: {
      accessToken: string;
      phoneNumberId: string;
      graphVersion: string;
      templates: { approval: string; reminder: string };
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async send(body: Record<string, unknown>): Promise<SentMessage> {
    const url = `https://graph.facebook.com/${this.cfg.graphVersion}/${this.cfg.phoneNumberId}/messages`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new MessagingError("Couldn't reach WhatsApp. Try again.", "unknown");
    }
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok || !data.messages?.[0]?.id) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      throw new MessagingError(`WhatsApp refused the message: ${msg}`, "rejected");
    }
    return { providerMessageId: data.messages[0].id };
  }

  private buttons(approvalId: string) {
    return [
      {
        type: "button",
        sub_type: "quick_reply",
        index: "0",
        parameters: [{ type: "payload", payload: approvePayload(approvalId) }],
      },
      {
        type: "button",
        sub_type: "quick_reply",
        index: "1",
        parameters: [{ type: "payload", payload: changePayload(approvalId) }],
      },
    ];
  }

  sendApprovalRequest(m: ApprovalRequestMessage) {
    const text = (t: string) => ({ type: "text", text: t });
    return this.send({
      to: toWaNumber(m.to),
      type: "template",
      template: {
        name: this.cfg.templates.approval,
        language: { code: m.language },
        components: [
          ...(m.photoUrl
            ? [{ type: "header", parameters: [{ type: "image", image: { link: m.photoUrl } }] }]
            : []),
          {
            type: "body",
            parameters: [
              text(m.ownerName),
              text(m.businessName),
              text(m.goLiveText),
              text(m.postPreview),
              text(m.approvalLink),
            ],
          },
          ...this.buttons(m.approvalId),
        ],
      },
    });
  }

  sendApprovalReminder(m: ApprovalReminderMessage) {
    const text = (t: string) => ({ type: "text", text: t });
    return this.send({
      to: toWaNumber(m.to),
      type: "template",
      template: {
        name: this.cfg.templates.reminder,
        language: { code: m.language },
        components: [
          {
            type: "body",
            parameters: [text(m.businessName), text(m.expiresText)],
          },
          ...this.buttons(m.approvalId),
        ],
      },
    });
  }

  sendText(to: string, body: string) {
    return this.send({ to: toWaNumber(to), type: "text", text: { body, preview_url: false } });
  }
}

// ───────────── webhook ─────────────

/** Meta signs every webhook with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface MetaWebhook {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          from: string;
          id: string;
          type: string;
          text?: { body?: string };
          button?: { payload?: string; text?: string };
          interactive?: { button_reply?: { id?: string; title?: string } };
        }[];
        statuses?: {
          id: string;
          status: string;
          errors?: { title?: string; message?: string }[];
        }[];
      };
    }[];
  }[];
}

/**
 * Turn a webhook body into the events we care about. Events for a different phone number
 * than ours are ignored, as is anything we don't understand.
 */
export function parseMetaWebhook(body: unknown, ourPhoneNumberId: string): InboundEvent[] {
  const events: InboundEvent[] = [];
  for (const entry of (body as MetaWebhook)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v || v.metadata?.phone_number_id !== ourPhoneNumberId) continue;
      for (const m of v.messages ?? []) {
        const payload = m.button?.payload ?? m.interactive?.button_reply?.id;
        if ((m.type === "button" || m.type === "interactive") && payload) {
          events.push({
            type: "button",
            from: m.from,
            messageId: m.id,
            payload,
            text: m.button?.text ?? m.interactive?.button_reply?.title ?? "",
          });
        } else if (m.type === "text" && m.text?.body) {
          events.push({ type: "text", from: m.from, messageId: m.id, text: m.text.body });
        }
      }
      for (const s of v.statuses ?? []) {
        if (["sent", "delivered", "read", "failed"].includes(s.status)) {
          events.push({
            type: "status",
            providerMessageId: s.id,
            status: s.status as "sent" | "delivered" | "read" | "failed",
            error: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null,
          });
        }
      }
    }
  }
  return events;
}

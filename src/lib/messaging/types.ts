/**
 * The only way the app sends or receives WhatsApp messages (docs/PLAN.md §2.1).
 * "mock" logs messages to the database; "meta" uses Meta's WhatsApp Cloud API.
 */

export type MessagingProviderKind = "mock" | "meta";

export interface ApprovalRequestMessage {
  to: string; // E.164, e.g. +919829012345
  language: "en" | "hi";
  ownerName: string;
  businessName: string;
  postPreview: string; // already shortened to fit the template
  goLiveText: string; // e.g. "on 20 Nov, 10:30 am"
  approvalLink: string;
  photoUrl: string | null;
  approvalId: string; // goes into the button payloads
}

export interface ApprovalReminderMessage {
  to: string;
  language: "en" | "hi";
  businessName: string;
  expiresText: string;
  approvalId: string;
}

export interface SentMessage {
  providerMessageId: string;
}

export interface MessagingProvider {
  readonly kind: MessagingProviderKind;
  sendApprovalRequest(msg: ApprovalRequestMessage): Promise<SentMessage>;
  sendApprovalReminder(msg: ApprovalReminderMessage): Promise<SentMessage>;
  /** Free-form text; only allowed within 24 h of the customer's last message. */
  sendText(to: string, body: string): Promise<SentMessage>;
}

export class MessagingError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "rejected" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

// ───────────── what we accept from WhatsApp ─────────────

export type InboundEvent =
  | { type: "button"; from: string; messageId: string; payload: string; text: string }
  | { type: "text"; from: string; messageId: string; text: string }
  | {
      type: "status";
      providerMessageId: string;
      status: "sent" | "delivered" | "read" | "failed";
      error: string | null;
    };

/** Button payloads are "approve:<approvalId>" or "change:<approvalId>". */
export function parseButtonPayload(
  payload: string,
): { decision: "approved" | "changes_requested"; approvalId: string } | null {
  const m = /^(approve|change):([0-9a-f-]{36})$/.exec(payload);
  if (!m) return null;
  return { decision: m[1] === "approve" ? "approved" : "changes_requested", approvalId: m[2] };
}

export const approvePayload = (id: string) => `approve:${id}`;
export const changePayload = (id: string) => `change:${id}`;

/** WhatsApp sends numbers without "+". We store E.164 with it. */
export const toE164 = (waNumber: string) => (waNumber.startsWith("+") ? waNumber : `+${waNumber}`);
export const toWaNumber = (e164: string) => e164.replace(/^\+/, "");

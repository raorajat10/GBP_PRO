/**
 * Rules every post body must follow (docs/PLAN.md §2.3 and §8). Pure functions, shared by
 * the AI guardrails, the editor's live warnings and the server's save check.
 */
import type { Language } from "@/lib/clients/schema";

/** Google Business Profile's limit for a post's text. */
export const POST_MAX_CHARS = 1500;

/**
 * 7+ digits in a row, allowing spaces, dashes, dots or brackets between them.
 * Counts Hindi (Devanagari) digits too: ९८२९० १२३४५.
 */
const PHONE = /(?:\+?\(?[0-9०-९][\s\-.()]{0,2}){7,}/;
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|in|net|org|co)\b/i;

export const hasPhoneNumber = (text: string) => PHONE.test(text);
export const hasLink = (text: string) => LINK.test(text);
export const charCount = (text: string) => [...text].length;

export type PostIssue = "empty" | "too_long" | "phone" | "link";

export const ISSUE_TEXT: Record<PostIssue, string> = {
  empty: "Write the post text.",
  too_long: `Keep it under ${POST_MAX_CHARS.toLocaleString("en-IN")} characters (Google's limit).`,
  phone: "Remove the phone number. The Call button already gives customers your number.",
  link: "Remove the link from the text. Use the button below the post for your website.",
};

export function postIssues(body: string): PostIssue[] {
  const t = body.trim();
  const issues: PostIssue[] = [];
  if (!t) issues.push("empty");
  if (charCount(t) > POST_MAX_CHARS) issues.push("too_long");
  if (hasPhoneNumber(t)) issues.push("phone");
  if (hasLink(t)) issues.push("link");
  return issues;
}

/**
 * Share of letters in Devanagari script (0..1). Digits, spaces and emoji don't count.
 * Vowel signs (ा ि ी …) are Unicode marks, not letters, so they're counted too.
 */
export function devanagariShare(text: string): number {
  const letters = text.match(/[\p{L}\p{M}]/gu) ?? [];
  if (!letters.length) return 0;
  const deva = letters.filter((c) => /\p{Script=Devanagari}/u.test(c)).length;
  return deva / letters.length;
}

/**
 * Is the text written in the script the language needs? Hindi = mostly Devanagari;
 * English and Hinglish = Roman letters (Hinglish is Hindi written in Roman script).
 * Hindi posts often keep the business or brand name in English, so half is enough.
 */
export function matchesLanguageScript(text: string, language: Language): boolean {
  const share = devanagariShare(text);
  return language === "hi" ? share >= 0.5 : share <= 0.1;
}

/** Statuses in which the team may still edit, rewrite or delete a post. */
export const EDITABLE_STATUSES = ["draft", "changes_requested", "expired"] as const;
export const isEditable = (status: string) =>
  (EDITABLE_STATUSES as readonly string[]).includes(status);

// ───────────── call-to-action button ─────────────

export const CTA_TYPES = [
  { value: "CALL", label: "Call now", needsUrl: false },
  { value: "LEARN_MORE", label: "Learn more", needsUrl: true },
  { value: "BOOK", label: "Book", needsUrl: true },
  { value: "ORDER", label: "Order online", needsUrl: true },
] as const;
export type CtaType = (typeof CTA_TYPES)[number]["value"];

export const TOPIC_TYPES = [
  { value: "STANDARD", label: "Update" },
  { value: "OFFER", label: "Offer" },
  { value: "EVENT", label: "Event" },
] as const;
export type TopicType = (typeof TOPIC_TYPES)[number]["value"];

// ───────────── schedule (India time) ─────────────

export const SCHEDULE_MIN_MINUTES = 30;
export const SCHEDULE_MAX_DAYS = 90;

/** "2026-11-20T10:30" typed in India time → a Date. Null if it isn't a valid value. */
export function parseIstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}:00+05:30`);
  return Number.isNaN(t) ? null : new Date(t);
}

/** A Date → "2026-11-20T10:30" in India time, for <input type="datetime-local">. */
export function toIstLocal(date: Date): string {
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16);
}

/** Earliest time the schedule picker should offer, as a datetime-local value in India time. */
export function earliestScheduleIstLocal(now: Date = new Date()): string {
  return toIstLocal(new Date(now.getTime() + SCHEDULE_MIN_MINUTES * 60_000));
}

export function scheduleProblem(when: Date, now: Date = new Date()): string | null {
  const diff = when.getTime() - now.getTime();
  if (diff < SCHEDULE_MIN_MINUTES * 60_000) {
    return `Pick a time at least ${SCHEDULE_MIN_MINUTES} minutes from now, so the owner has time to approve it.`;
  }
  if (diff > SCHEDULE_MAX_DAYS * 86_400_000) {
    return `Pick a time within the next ${SCHEDULE_MAX_DAYS} days.`;
  }
  return null;
}

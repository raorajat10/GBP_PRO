import type { AuditCheckKey } from "@/config/audit";
import type { AuditStatus } from "@/lib/audit/checks";
import type { Language } from "@/lib/clients/schema";
import { matchesLanguageScript, postIssues, type TopicType } from "@/lib/posts/rules";

/**
 * Everything the app asks an AI model to write goes through this interface, so tests
 * use a fake and the real model can change without touching callers (docs/PLAN.md §2.1).
 */

export interface AuditFixRequest {
  business: {
    title: string;
    primaryCategory: string | null;
    additionalCategories: string[];
    area: string | null;
    city: string | null;
    services: string[];
    attributes: string[];
    description: string | null;
    industryNote: string | null; // the team's brand notes for this client
  };
  /** Only the checks that lost points, most important first. */
  items: {
    key: AuditCheckKey;
    title: string;
    status: Exclude<AuditStatus, "pass">;
    pointsLost: number;
    facts: string;
    ruleFix: string;
  }[];
}

export interface AuditFixResult {
  fixes: { key: AuditCheckKey; text: string }[];
  /** A ready-to-paste description, only when the description check lost points. */
  suggestedDescription: string | null;
  model: string;
}

export interface PostDraftRequest {
  business: {
    title: string;
    category: string | null;
    area: string | null;
    city: string | null;
    industry: string | null; // battery | solar | clinic | retail | other
    services: string[];
    brandNotes: string | null;
  };
  /** What the account manager typed, e.g. "Exide inverter battery offer, 2-year warranty". */
  note: string;
  language: Language;
  topicType: TopicType;
  /** The resized JPEG, so the model can describe what's actually in the photo. */
  photo: { base64: string; mediaType: "image/jpeg" } | null;
}

export interface PostDraftResult {
  drafts: { body: string; angle: string }[];
  model: string;
}

export interface AiWriter {
  readonly model: string;
  writeAuditFixes(input: AuditFixRequest): Promise<AuditFixResult>;
  writePostDrafts(input: PostDraftRequest): Promise<PostDraftResult>;
}

/** How many drafts the post generator offers. */
export const POST_DRAFT_COUNT = 3;

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "refused" | "rate_limited" | "invalid_output" | "unknown",
  ) {
    super(message);
    this.name = "AiError";
  }
}

// ───────────── guardrails on AI output (docs/PLAN.md §8) ─────────────

/** 7+ digits in a row (allowing spaces/dashes) looks like a phone number. */
const PHONE = /(?:\+?\d[\s-]?){7,}/;
const URL_RE = /\bhttps?:\/\/|\bwww\./i;
const MAX_FIX_CHARS = 600;

export const DESCRIPTION_LIMITS = { min: 250, max: 750 } as const;

/**
 * Keep only fixes for checks we asked about, trimmed and free of phone numbers and links.
 * Anything that fails is dropped and the rule-based fix stays.
 */
export function sanitizeAuditFixes(
  input: AuditFixRequest,
  raw: { fixes: { key: string; text: string }[]; suggestedDescription: string | null },
  model: string,
): AuditFixResult {
  const asked = new Set(input.items.map((i) => i.key));
  const seen = new Set<string>();
  const fixes: AuditFixResult["fixes"] = [];
  for (const f of raw.fixes) {
    const text = f.text.trim().replace(/\s+/g, " ");
    if (!asked.has(f.key as AuditCheckKey) || seen.has(f.key)) continue;
    if (!text || text.length > MAX_FIX_CHARS || PHONE.test(text) || URL_RE.test(text)) continue;
    seen.add(f.key);
    fixes.push({ key: f.key as AuditCheckKey, text });
  }

  let suggestedDescription: string | null = null;
  const d = raw.suggestedDescription?.trim();
  if (d && asked.has("description")) {
    const len = [...d].length;
    if (
      len >= DESCRIPTION_LIMITS.min &&
      len <= DESCRIPTION_LIMITS.max &&
      !PHONE.test(d) &&
      !URL_RE.test(d)
    ) {
      suggestedDescription = d;
    }
  }
  return { fixes, suggestedDescription, model };
}

/**
 * Keep only post drafts that are safe to show: within Google's length limit, no phone
 * numbers or links, and in the script the chosen language needs. Throws if none survive,
 * so the manager is never handed a draft that breaks the rules.
 */
export function sanitizePostDrafts(
  input: Pick<PostDraftRequest, "language">,
  raw: { drafts: { body: string; angle: string }[] },
  model: string,
  options: { checkScript?: boolean } = {},
): PostDraftResult {
  const checkScript = options.checkScript ?? true;
  const seen = new Set<string>();
  const drafts: PostDraftResult["drafts"] = [];
  for (const d of raw.drafts) {
    const body = d.body
      .trim()
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    if (seen.has(body) || postIssues(body).length) continue;
    if (checkScript && !matchesLanguageScript(body, input.language)) continue;
    seen.add(body);
    drafts.push({ body, angle: d.angle.trim().slice(0, 60) || "Draft" });
    if (drafts.length === POST_DRAFT_COUNT) break;
  }
  if (!drafts.length) {
    throw new AiError(
      "The AI's drafts broke the posting rules (length, phone numbers or language). Try again.",
      "invalid_output",
    );
  }
  return { drafts, model };
}

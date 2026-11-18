import type { AuditFixRequest } from "../writer";
import { DESCRIPTION_LIMITS } from "../writer";

/** Stable instructions (kept identical between calls so they can be cached). */
export const AUDIT_FIX_SYSTEM = `You help an Indian digital agency improve small local businesses' Google Business Profiles.
You receive one business and the audit checks it lost points on. For each check, write a short, specific fix the agency's account manager can act on this week.

Rules:
- Plain, simple English an account manager in Jaipur can follow. One to three sentences per fix. Address the manager ("Add…", "Ask the owner…").
- Be specific to this business: use its category, services and area. Suggest concrete photo subjects, post ideas, services or attributes that fit this kind of business.
- Use only facts given to you. Never invent prices, offers, discounts, guarantees, awards, years in business, certifications or medical claims.
- Never include phone numbers, email addresses or links.
- Reviews: only suggest asking all customers for reviews with the same official link. Never suggest offering incentives, asking only happy customers, writing reviews for the business, or filtering who gets the link.
- For the "description" check only, also write suggestedDescription: a ready-to-paste Google Business Profile description of ${DESCRIPTION_LIMITS.min}–${DESCRIPTION_LIMITS.max} characters, in English, that says what the business does, its main services and the area it serves. No phone numbers, links, prices or offers, and no ALL-CAPS. If the description check is not in the list, set suggestedDescription to null.
- Return one entry in "fixes" per check you were given, using the check's key.`;

export function auditFixUserMessage(input: AuditFixRequest): string {
  const b = input.business;
  const lines = [
    "<business>",
    `Name: ${b.title}`,
    `Primary category: ${b.primaryCategory ?? "not set"}`,
    `Other categories: ${b.additionalCategories.join(", ") || "none"}`,
    `Area: ${[b.area, b.city].filter(Boolean).join(", ") || "unknown"}`,
    `Services listed: ${b.services.join(", ") || "none"}`,
    `Attributes set: ${b.attributes.join(", ") || "none"}`,
    `Current description: ${b.description ?? "none"}`,
    ...(b.industryNote ? [`Notes from the agency: ${b.industryNote}`] : []),
    "</business>",
    "",
    "<checks>",
    ...input.items.map(
      (i) =>
        `- key: ${i.key}\n  check: ${i.title}\n  points lost: ${i.pointsLost}\n  found: ${i.facts}\n  generic fix: ${i.ruleFix}`,
    ),
    "</checks>",
  ];
  return lines.join("\n");
}

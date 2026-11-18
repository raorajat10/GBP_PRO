import { createHash, randomBytes } from "node:crypto";

/**
 * Approval links carry a random 256-bit token. Only its SHA-256 hash is stored, so a
 * database leak can't be turned into working approval links.
 */
export function newApprovalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashApprovalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Shape check before touching the database (43 base64url characters). */
export function looksLikeApprovalToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** How long the owner has to answer, and when we remind them (docs/PLAN.md Q11). */
export const APPROVAL_EXPIRY_HOURS = 72;
export const APPROVAL_REMINDER_HOURS = 24;

export const approvalUrl = (appUrl: string, token: string) =>
  new URL(`/approve/${token}`, appUrl).toString();

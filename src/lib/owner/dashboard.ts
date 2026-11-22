/**
 * Pure rules for the business owner's dashboard (/home): what to ask the owner to do,
 * what our team is working on, and how the score moved. No Next/Supabase imports.
 */
import { CHECK_TITLES } from "@/lib/audit/checks";
import type { AuditCheckKey } from "@/config/audit";

export interface OwnerAuditItem {
  key: string;
  title: string;
  status: "pass" | "warn" | "fail";
  points: number;
  pointsMax: number;
  rank: number;
}

export interface OwnerTask {
  id: "approvals" | "reviews" | "photos";
  title: string;
  why: string;
  tag: string;
  /** Present when the owner can act straight from the dashboard. */
  action?: { kind: "share-review-page"; slug: string };
}

/** Checks only the owner can really move. Everything else is our team's job. */
const OWNER_CHECKS = new Set(["reviews", "photos"]);

export function ownerTasks(input: {
  items: OwnerAuditItem[];
  pendingApprovals: number;
  reviewPageSlug: string | null;
}): OwnerTask[] {
  const tasks: OwnerTask[] = [];
  if (input.pendingApprovals > 0) {
    tasks.push({
      id: "approvals",
      tag: "Posts",
      title:
        input.pendingApprovals === 1
          ? "Approve the post waiting for you"
          : `Approve the ${input.pendingApprovals} posts waiting for you`,
      why: "Open the WhatsApp message or link our team sent you. Nothing goes live without your OK.",
    });
  }
  const failing = (key: string) => input.items.some((i) => i.key === key && i.status !== "pass");
  // With no audit yet, asking for reviews is still the best thing an owner can do.
  if (input.reviewPageSlug && (failing("reviews") || input.items.length === 0)) {
    tasks.push({
      id: "reviews",
      tag: "Reviews",
      title: "Ask one happy customer for a Google review",
      why: "Fresh reviews are one of the strongest signals for showing up in local searches.",
      action: { kind: "share-review-page", slug: input.reviewPageSlug },
    });
  }
  if (failing("photos")) {
    tasks.push({
      id: "photos",
      tag: "Photos",
      title: "Send us 3–5 new photos of your work",
      why: "Recent photos of your shop, team and finished work help customers trust you. Share them with our team on WhatsApp.",
    });
  }
  return tasks;
}

/** Failing checks our team handles, most points to win back first. */
export function teamWorkItems(items: OwnerAuditItem[], limit = 4): OwnerAuditItem[] {
  return items
    .filter((i) => i.status !== "pass" && !OWNER_CHECKS.has(i.key))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

/** Breakdown rows in a fixed, familiar order (the order of CHECK_TITLES). */
export function breakdownRows(items: OwnerAuditItem[]): OwnerAuditItem[] {
  const order = Object.keys(CHECK_TITLES) as AuditCheckKey[];
  const pos = (k: string) => {
    const i = order.indexOf(k as AuditCheckKey);
    return i === -1 ? order.length : i;
  };
  return [...items].sort((a, b) => pos(a.key) - pos(b.key));
}

export function scoreChange(
  score: number,
  previous: number | null,
): { delta: number; label: string } | null {
  if (previous == null) return null;
  const delta = score - previous;
  if (delta === 0) return { delta, label: "No change since last check" };
  const pts = Math.abs(delta) === 1 ? "pt" : "pts";
  return {
    delta,
    label: `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} ${pts} since last check`,
  };
}

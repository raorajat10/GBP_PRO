/** Which reviews get an automatic thank-you. Pure, unit-tested. */

export interface AutoReplySettings {
  /** When auto reply was switched on; null = off. */
  since: string | null;
  minStars: number;
}

export interface ReviewForAutoReply {
  id: string;
  starRating: number;
  reviewedAt: string;
  hasReply: boolean;
}

/** Most automatic replies posted for one profile in one run (the rest wait for the next run). */
export const AUTO_REPLY_BATCH = 20;

/** Most old reviews thanked per press of "Thank all unanswered good reviews". */
export const BACKLOG_BATCH = 50;

/** What to tell the person after a backlog run. */
export function backlogMessage(r: { posted: number; failed: number; remaining: number }): string {
  if (!r.posted && !r.failed) return "Every good review already has a reply.";
  const parts = [`Thanked ${r.posted} ${r.posted === 1 ? "review" : "reviews"} on Google.`];
  if (r.failed) parts.push(`${r.failed} couldn't be posted; try again later.`);
  if (r.remaining) parts.push(`${r.remaining} more left: press again to continue.`);
  return parts.join(" ");
}

export function reviewsToAutoReply(
  reviews: ReviewForAutoReply[],
  settings: AutoReplySettings,
): ReviewForAutoReply[] {
  if (!settings.since) return [];
  const since = Date.parse(settings.since);
  return reviews
    .filter(
      (r) => !r.hasReply && r.starRating >= settings.minStars && Date.parse(r.reviewedAt) >= since,
    )
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    .slice(0, AUTO_REPLY_BATCH);
}

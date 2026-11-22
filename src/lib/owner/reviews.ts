/** Filters and summary maths for the owner's Reviews page. Pure, unit-tested. */

export type ReplyFilter = "all" | "replied" | "unreplied";
export type ReviewSort = "newest" | "oldest" | "lowest" | "highest";

export interface ReviewFilters {
  stars: 1 | 2 | 3 | 4 | 5 | null;
  reply: ReplyFilter;
  sort: ReviewSort;
  page: number;
}

export const REVIEWS_PER_PAGE = 20;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseReviewFilters(
  sp: Record<string, string | string[] | undefined>,
): ReviewFilters {
  const s = Number(one(sp.stars));
  const reply = one(sp.reply);
  const sort = one(sp.sort);
  const page = Math.floor(Number(one(sp.page)));
  return {
    stars: [1, 2, 3, 4, 5].includes(s) ? (s as ReviewFilters["stars"]) : null,
    reply: reply === "replied" || reply === "unreplied" ? reply : "all",
    sort: sort === "oldest" || sort === "lowest" || sort === "highest" ? sort : "newest",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** Query string for a filter set, dropping defaults so URLs stay short. */
export function reviewFilterQuery(f: Partial<ReviewFilters>): string {
  const q = new URLSearchParams();
  if (f.stars) q.set("stars", String(f.stars));
  if (f.reply && f.reply !== "all") q.set("reply", f.reply);
  if (f.sort && f.sort !== "newest") q.set("sort", f.sort);
  if (f.page && f.page > 1) q.set("page", String(f.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface ReviewSummary {
  total: number;
  average: number | null;
  /** index 0 = 1 star … index 4 = 5 stars */
  counts: [number, number, number, number, number];
  replied: number;
  replyRate: number | null; // 0..1
  needsReply: number;
}

export function summarizeReviews(rows: { star_rating: number; replied: boolean }[]): ReviewSummary {
  const counts: ReviewSummary["counts"] = [0, 0, 0, 0, 0];
  let sum = 0;
  let replied = 0;
  for (const r of rows) {
    if (r.star_rating >= 1 && r.star_rating <= 5) counts[r.star_rating - 1]++;
    sum += r.star_rating;
    if (r.replied) replied++;
  }
  const total = rows.length;
  return {
    total,
    average: total ? Math.round((sum / total) * 10) / 10 : null,
    counts,
    replied,
    replyRate: total ? replied / total : null,
    needsReply: total - replied,
  };
}

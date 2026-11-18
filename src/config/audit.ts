/**
 * Profile audit settings (docs/PLAN.md §3.1). Tune the weights and targets here — no
 * other file needs to change. Weights must add up to 100 (a unit test checks this).
 */

export const AUDIT_WEIGHTS = {
  description: 10,
  categories: 10,
  hours: 8,
  contact: 6,
  photos: 14,
  posts: 12,
  reviews: 14,
  replies: 12,
  services: 8,
  attributes: 6,
} as const;

export type AuditCheckKey = keyof typeof AUDIT_WEIGHTS;

export const AUDIT_TARGETS = {
  descriptionMinChars: 250,
  descriptionMaxChars: 750,
  secondaryCategories: 2,
  photosTotal: 10,
  photoRecentDays: 30,
  postsLast30Days: 4,
  reviewsCount: 25,
  /** Full marks at or above this average; zero at or below `ratingFloor`, linear between. */
  avgRating: 4.2,
  ratingFloor: 3.5,
  replyRate: 0.9,
  medianReplyHours: 48,
  services: 3,
  attributes: 3,
  /** Special hours should cover holidays coming up within this many days. */
  holidayLookaheadDays: 45,
} as const;

/**
 * Holidays when Jaipur businesses commonly change their hours. Festivals on the lunar
 * calendar move every year — add next year's dates each December.
 */
export const HOLIDAYS: { date: string; name: string }[] = [
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-14", name: "Makar Sankranti" },
  { date: "2027-01-26", name: "Republic Day" },
  { date: "2027-03-22", name: "Holi" },
  { date: "2027-08-15", name: "Independence Day" },
  { date: "2027-10-02", name: "Gandhi Jayanti" },
  { date: "2027-10-29", name: "Diwali" },
  { date: "2027-12-25", name: "Christmas" },
];

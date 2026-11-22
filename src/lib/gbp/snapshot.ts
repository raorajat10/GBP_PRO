import type {
  DailyMetrics,
  GbpCredentials,
  GbpLocalPost,
  GbpLocation,
  GbpMedia,
  GbpProvider,
  GbpReview,
} from "./types";

/** Everything the audit and dashboards need about one profile, stored in locations.snapshot. */
export interface LocationSnapshot {
  version: 1;
  profile: GbpLocation;
  photos: {
    total: number;
    last30Days: number;
    hasLogo: boolean;
    hasCover: boolean;
    latest: string | null;
    /** Photo count per Google category. Missing on snapshots taken before it existed. */
    byCategory?: Partial<Record<GbpMedia["category"], number>>;
  };
  posts: { total: number; last7Days: number; last30Days: number; latest: string | null };
  reviews: {
    total: number;
    average: number | null;
    unanswered: number;
    last90Days: number;
    repliedLast90Days: number;
    replyRateLast90Days: number | null; // 0..1
    medianReplyHoursLast90Days: number | null;
    latest: string | null;
    /** Newest few reviews for the owner dashboard. Missing on snapshots taken before it existed. */
    recent?: RecentReview[];
  };
  metrics: {
    days: number; // how many days of data the totals cover
    from: string | null;
    to: string | null;
    impressions: number;
    calls: number;
    directionRequests: number;
    websiteClicks: number;
  };
  syncedAt: string;
}

export interface RecentReview {
  reviewer: string;
  starRating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createTime: string;
  replied: boolean;
}

/** How many of the newest reviews a snapshot keeps. */
export const RECENT_REVIEWS_KEPT = 5;

const DAY = 86_400_000;
const latestOf = (times: string[]) =>
  times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
const within = (iso: string, now: number, days: number) => now - Date.parse(iso) <= days * DAY;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarizeLocation(input: {
  profile: GbpLocation;
  media: GbpMedia[];
  posts: GbpLocalPost[];
  reviews: GbpReview[];
  metrics: DailyMetrics[];
  now?: Date;
}): LocationSnapshot {
  const now = (input.now ?? new Date()).getTime();
  const { media, reviews, metrics } = input;
  const livePosts = input.posts.filter((p) => p.state === "LIVE");

  const recentReviews = reviews.filter((r) => within(r.createTime, now, 90));
  const repliedRecent = recentReviews.filter((r) => r.reply);
  const replyHours = repliedRecent.map(
    (r) => (Date.parse(r.reply!.updateTime) - Date.parse(r.createTime)) / 3_600_000,
  );
  const sum = (key: keyof Omit<DailyMetrics, "date">) => metrics.reduce((t, m) => t + m[key], 0);
  const dates = metrics.map((m) => m.date).sort();

  return {
    version: 1,
    profile: input.profile,
    photos: {
      total: media.length,
      last30Days: media.filter((m) => within(m.createTime, now, 30)).length,
      hasLogo: media.some((m) => m.category === "LOGO"),
      hasCover: media.some((m) => m.category === "COVER"),
      latest: latestOf(media.map((m) => m.createTime)),
      byCategory: media.reduce<Record<string, number>>((acc, m) => {
        acc[m.category] = (acc[m.category] ?? 0) + 1;
        return acc;
      }, {}),
    },
    posts: {
      total: livePosts.length,
      last7Days: livePosts.filter((p) => within(p.createTime, now, 7)).length,
      last30Days: livePosts.filter((p) => within(p.createTime, now, 30)).length,
      latest: latestOf(livePosts.map((p) => p.createTime)),
    },
    reviews: {
      total: reviews.length,
      average: reviews.length
        ? Math.round((reviews.reduce((t, r) => t + r.starRating, 0) / reviews.length) * 10) / 10
        : null,
      unanswered: reviews.filter((r) => !r.reply).length,
      last90Days: recentReviews.length,
      repliedLast90Days: repliedRecent.length,
      replyRateLast90Days: recentReviews.length
        ? repliedRecent.length / recentReviews.length
        : null,
      medianReplyHoursLast90Days: median(replyHours),
      latest: latestOf(reviews.map((r) => r.createTime)),
      recent: [...reviews]
        .sort((a, b) => Date.parse(b.createTime) - Date.parse(a.createTime))
        .slice(0, RECENT_REVIEWS_KEPT)
        .map((r) => ({
          reviewer: r.reviewer,
          starRating: r.starRating,
          comment: r.comment,
          createTime: r.createTime,
          replied: Boolean(r.reply),
        })),
    },
    metrics: {
      days: metrics.length,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
      impressions: sum("impressionsSearch") + sum("impressionsMaps"),
      calls: sum("calls"),
      directionRequests: sum("directionRequests"),
      websiteClicks: sum("websiteClicks"),
    },
    syncedAt: new Date(now).toISOString(),
  };
}

/** Days of daily metrics kept for the owner's analytics (the snapshot summarises the last 28). */
export const METRIC_HISTORY_DAYS = 90;
const SNAPSHOT_METRIC_DAYS = 28;

export interface CollectedProfile {
  snapshot: LocationSnapshot;
  /** Every review, for the reviews table. */
  reviews: GbpReview[];
  /** Up to METRIC_HISTORY_DAYS of daily numbers, for the metrics table. */
  metrics: DailyMetrics[];
}

/** Fetch everything for one location: the snapshot plus the raw reviews and daily metrics. */
export async function collectProfile(
  provider: GbpProvider,
  creds: GbpCredentials,
  locationName: string,
  now: Date = new Date(),
): Promise<CollectedProfile> {
  const day = (n: number) => new Date(now.getTime() - n * DAY).toISOString().slice(0, 10);
  const [profile, media, posts, reviews, metrics] = await Promise.all([
    provider.getLocation(creds, locationName),
    provider.listMedia(creds, locationName),
    provider.listLocalPosts(creds, locationName),
    provider.listReviews(creds, locationName),
    provider.getDailyMetrics(creds, locationName, {
      start: day(METRIC_HISTORY_DAYS),
      end: day(1),
    }),
  ]);
  const recentFrom = day(SNAPSHOT_METRIC_DAYS);
  const snapshot = summarizeLocation({
    profile,
    media,
    posts,
    reviews,
    metrics: metrics.filter((m) => m.date >= recentFrom),
    now,
  });
  return { snapshot, reviews, metrics };
}

/** Fetch everything for one location and summarise it. Last 28 days of metrics. */
export async function collectSnapshot(
  provider: GbpProvider,
  creds: GbpCredentials,
  locationName: string,
  now: Date = new Date(),
): Promise<LocationSnapshot> {
  return (await collectProfile(provider, creds, locationName, now)).snapshot;
}

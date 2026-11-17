import {
  GbpError,
  type ConnectMode,
  type ConnectedAccount,
  type DailyMetrics,
  type GbpCredentials,
  type GbpLocalPost,
  type GbpLocation,
  type GbpMedia,
  type GbpProvider,
  type GbpReview,
  type MediaCategory,
} from "../types";
import {
  ARCHETYPES,
  OWNER_ACCOUNT_PREFIX,
  POST_TEXT,
  REPLY_TEXT,
  REVIEWERS,
  REVIEW_TEXT,
  TEAM_ACCOUNT,
  WEEK,
  type Archetype,
} from "./data";

const DAY = 86_400_000;
/** Google's performance data arrives a few days late; the mock does the same. */
export const METRICS_LAG_DAYS = 3;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic PRNG so the same location always produces the same sample data. */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Sample-data implementation of GbpProvider. Used until Google approves API access;
 * it must behave like the real one (same shapes, same permission rules).
 */
export class MockGbpProvider implements GbpProvider {
  readonly kind = "mock" as const;
  private readonly today: number;

  constructor(now: Date = new Date()) {
    this.today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  authorizationUrl({ state, mode, appUrl }: { state: string; mode: ConnectMode; appUrl: string }) {
    const url = new URL("/connect/google/sample", appUrl);
    url.searchParams.set("state", state);
    url.searchParams.set("mode", mode);
    return url.toString();
  }

  async exchangeCode({
    code,
    mode,
  }: {
    code: string;
    mode: ConnectMode;
    appUrl: string;
  }): Promise<ConnectedAccount> {
    if (mode === "agency" && code === "sample-team") {
      return { accountName: TEAM_ACCOUNT.name, label: TEAM_ACCOUNT.label, refreshToken: null };
    }
    if (mode === "owner" && code === "sample-owner") {
      // A fresh sample owner account each time, so several clients can each connect one.
      const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      return {
        accountName: `${OWNER_ACCOUNT_PREFIX}${suffix}`,
        label: "Owner's Google account (sample)",
        refreshToken: null,
      };
    }
    throw new GbpError("The sample sign-in code was not recognised.", "auth");
  }

  // ───────────── reads ─────────────

  async listLocations(creds: GbpCredentials): Promise<GbpLocation[]> {
    return this.archetypesFor(creds.accountName).map(({ archetype, locationId }) =>
      this.buildLocation(creds.accountName, archetype, locationId),
    );
  }

  async getLocation(creds: GbpCredentials, locationName: string): Promise<GbpLocation> {
    const { archetype, locationId } = this.find(creds, locationName);
    return this.buildLocation(creds.accountName, archetype, locationId);
  }

  async listMedia(creds: GbpCredentials, locationName: string): Promise<GbpMedia[]> {
    const { archetype: a } = this.find(creds, locationName);
    const r = rng(`${locationName}:media`);
    const fixed: MediaCategory[] = [
      ...(a.hasLogo ? (["LOGO"] as const) : []),
      ...(a.hasCover ? (["COVER"] as const) : []),
    ];
    const others: MediaCategory[] = ["EXTERIOR", "INTERIOR", "PRODUCT", "AT_WORK", "TEAM"];
    return Array.from({ length: a.photos }, (_, i) => {
      const category = i < fixed.length ? fixed[i] : others[Math.floor(r() * others.length)];
      const daysAgo = i === 0 ? a.latestPhotoDaysAgo : a.latestPhotoDaysAgo + Math.floor(r() * 400);
      return {
        name: `${locationName}/media/p${i + 1}`,
        category,
        createTime: this.daysAgo(daysAgo),
      };
    });
  }

  async listReviews(creds: GbpCredentials, locationName: string): Promise<GbpReview[]> {
    const { archetype: a } = this.find(creds, locationName);
    const r = rng(`${locationName}:reviews`);
    const p = (a.avgRating - 1) / 4; // stars = 1 + Binomial(4, p) → mean = avgRating
    const reviews: GbpReview[] = Array.from({ length: a.reviews }, (_, i) => {
      let stars = 1;
      for (let k = 0; k < 4; k++) if (r() < p) stars++;
      const starRating = stars as GbpReview["starRating"];
      const bucket = stars >= 4 ? "good" : stars === 3 ? "ok" : "bad";
      const pool = REVIEW_TEXT[bucket];
      const comment = r() < 0.8 ? pool[Math.floor(r() * pool.length)] : null;
      const created = this.today - Math.floor(r() * r() * 720 * DAY) - Math.floor(r() * DAY);
      let reply: GbpReview["reply"] = null;
      if (r() < a.replyRate) {
        const replyAt = Math.min(
          created + a.replyHours * (0.3 + r() * 1.4) * 3_600_000,
          this.today,
        );
        reply = { comment: REPLY_TEXT[bucket], updateTime: new Date(replyAt).toISOString() };
      }
      return {
        name: `${locationName}/reviews/r${i + 1}`,
        reviewer: REVIEWERS[Math.floor(r() * REVIEWERS.length)],
        starRating,
        comment,
        createTime: new Date(created).toISOString(),
        reply,
      };
    });
    return reviews.sort((x, y) => y.createTime.localeCompare(x.createTime));
  }

  async listLocalPosts(creds: GbpCredentials, locationName: string): Promise<GbpLocalPost[]> {
    const { archetype: a } = this.find(creds, locationName);
    const r = rng(`${locationName}:posts`);
    let daysAgo = a.latestPostDaysAgo;
    return Array.from({ length: a.posts }, (_, i) => {
      const post: GbpLocalPost = {
        name: `${locationName}/localPosts/lp${i + 1}`,
        summary: POST_TEXT[i % POST_TEXT.length],
        topicType: "STANDARD",
        state: "LIVE",
        createTime: this.daysAgo(daysAgo),
      };
      daysAgo += 5 + Math.floor(r() * 12);
      return post;
    });
  }

  async getDailyMetrics(
    creds: GbpCredentials,
    locationName: string,
    range: { start: string; end: string },
  ): Promise<DailyMetrics[]> {
    const { archetype: a } = this.find(creds, locationName);
    const latest = this.today - METRICS_LAG_DAYS * DAY;
    const start = Date.parse(`${range.start}T00:00:00Z`);
    const end = Math.min(Date.parse(`${range.end}T00:00:00Z`), latest);
    if (Number.isNaN(start) || Number.isNaN(end)) throw new GbpError("Invalid date range.");

    const out: DailyMetrics[] = [];
    for (let t = start; t <= end; t += DAY) {
      const date = isoDate(new Date(t));
      const r = rng(`${locationName}:${date}`);
      const weekday = new Date(t).getUTCDay(); // 0 = Sunday
      const f = (weekday === 0 ? 0.7 : 1) * (0.75 + r() * 0.5);
      const views = a.dailyImpressions * f;
      out.push({
        date,
        impressionsSearch: Math.round(views * 0.6),
        impressionsMaps: Math.round(views * 0.4),
        calls: Math.round(views * 0.03 * (0.5 + r())),
        directionRequests: Math.round(views * 0.02 * (0.5 + r())),
        websiteClicks: a.website ? Math.round(views * 0.015 * (0.5 + r())) : 0,
      });
    }
    return out;
  }

  // ───────────── helpers ─────────────

  private daysAgo(days: number) {
    return new Date(this.today - days * DAY).toISOString();
  }

  private archetypesFor(accountName: string): { archetype: Archetype; locationId: string }[] {
    if (accountName === TEAM_ACCOUNT.name) {
      return ARCHETYPES.map((archetype) => ({ archetype, locationId: archetype.id }));
    }
    if (accountName.startsWith(OWNER_ACCOUNT_PREFIX)) {
      const h = hash(accountName);
      const archetype = ARCHETYPES[h % ARCHETYPES.length];
      return [{ archetype, locationId: `92${String(h).padStart(10, "0").slice(0, 8)}` }];
    }
    throw new GbpError("This Google account isn't connected.", "auth");
  }

  /** Like the real API: an account can only read locations it manages. */
  private find(creds: GbpCredentials, locationName: string) {
    const match = this.archetypesFor(creds.accountName).find(
      (x) => `locations/${x.locationId}` === locationName,
    );
    if (!match)
      throw new GbpError("This profile isn't available to the connected account.", "not_found");
    return match;
  }

  private buildLocation(accountName: string, a: Archetype, locationId: string): GbpLocation {
    const isOwner = accountName.startsWith(OWNER_ACCOUNT_PREFIX);
    const hoursDays = a.hours === "full" ? WEEK : a.hours === "weekdays" ? WEEK.slice(0, 6) : [];
    const upcoming = new Date(this.today + 20 * DAY);
    return {
      name: `locations/${locationId}`,
      accountName,
      title: isOwner ? `${a.title} (owner account)` : a.title,
      placeId: `SAMPLE_PLACE_${locationId}`,
      verified: a.verified,
      primaryCategory: a.category,
      additionalCategories: a.extraCategories,
      phone: a.phone ? `+91 141 000 ${locationId.slice(-4)}` : null,
      websiteUri: a.website ? `https://example.com/${locationId}` : null,
      address: {
        addressLines: [`Shop ${Number(locationId.slice(-2))}`, a.area],
        locality: "Jaipur",
        administrativeArea: "Rajasthan",
        postalCode: a.postalCode,
        regionCode: "IN",
      },
      description: a.description,
      regularHours: hoursDays.map((day) => ({
        day,
        open: day === "SUNDAY" ? "11:00" : "10:00",
        close: day === "SUNDAY" ? "14:00" : "19:30",
      })),
      specialHours: a.specialHours ? [{ date: isoDate(upcoming), closed: true }] : [],
      services: a.services,
      attributes: a.attributes,
      openingDate: null,
    };
  }
}

/**
 * The profile audit (docs/PLAN.md §3.1). Pure functions over a stored LocationSnapshot:
 * no AI and no network, so the same snapshot always gives the same score.
 * Claude is used only afterwards, to word the fixes (see src/lib/ai).
 */
import { AUDIT_TARGETS as T, AUDIT_WEIGHTS, HOLIDAYS, type AuditCheckKey } from "@/config/audit";
import type { LocationSnapshot } from "@/lib/gbp/snapshot";

export type AuditStatus = "pass" | "warn" | "fail";

export interface AuditItem {
  key: AuditCheckKey;
  title: string;
  status: AuditStatus;
  points: number;
  maxPoints: number;
  pointsLost: number;
  /** What we found, in plain words. */
  facts: string;
  /** Rule-based fix, always present. AI wording may replace it later. Empty when passed. */
  fix: string;
  /** 1 = most points to win back. Passed checks come last. */
  rank: number;
}

export interface AuditResult {
  score: number; // 0..100
  items: AuditItem[]; // ranked
}

interface Part {
  share: number; // fraction of the check's weight, parts add up to 1
  earned: number; // 0..1
}

interface Evaluation {
  parts: Part[];
  facts: string[];
  fixes: string[];
}

const DAY = 86_400_000;
const nf = new Intl.NumberFormat("en-IN");
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const ratio = (value: number, target: number) => Math.max(0, Math.min(1, value / target));
const plural = (n: number, one: string, many = `${one}s`) =>
  `${nf.format(n)} ${n === 1 ? one : many}`;

export const CHECK_TITLES: Record<AuditCheckKey, string> = {
  description: "Business description",
  categories: "Categories",
  hours: "Opening and holiday hours",
  contact: "Phone and website",
  photos: "Photos",
  posts: "Regular posts",
  reviews: "Number of reviews and rating",
  replies: "Replying to reviews",
  services: "Services listed",
  attributes: "Attributes (payments, accessibility…)",
};

/** Area names to look for in the description: the locality line, e.g. "Vaishali Nagar". */
function areaWords(s: LocationSnapshot): string[] {
  const a = s.profile.address;
  if (!a) return [];
  return [a.addressLines.at(-1), a.locality].filter((x): x is string => Boolean(x?.trim()));
}

/** Words that show the description says what the business does. */
function serviceWords(s: LocationSnapshot): string[] {
  const p = s.profile;
  const phrases = [
    ...p.services,
    p.primaryCategory?.displayName,
    ...p.additionalCategories.map((c) => c.displayName),
  ].filter((x): x is string => Boolean(x));
  // Match on meaningful single words ("solar", "battery", "dental") as well as whole phrases.
  const generic = new Set(["service", "services", "store", "shop", "company", "care", "and"]);
  const words = phrases.flatMap((ph) =>
    ph
      .toLowerCase()
      .split(/[^a-zऀ-ॿ]+/)
      .filter((w) => w.length >= 4 && !generic.has(w)),
  );
  return [...new Set([...phrases.map((p) => p.toLowerCase()), ...words])];
}

const mentions = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
};

export function upcomingHolidays(now: number, days = T.holidayLookaheadDays) {
  const today = new Date(now).toISOString().slice(0, 10);
  const until = new Date(now + days * DAY).toISOString().slice(0, 10);
  return HOLIDAYS.filter((h) => h.date >= today && h.date <= until);
}

const CHECKS: Record<AuditCheckKey, (s: LocationSnapshot, now: number) => Evaluation> = {
  description(s) {
    const text = s.profile.description?.trim() ?? "";
    if (!text) {
      return {
        parts: [{ share: 1, earned: 0 }],
        facts: ["No business description."],
        fixes: [
          `Add a ${T.descriptionMinChars}–${T.descriptionMaxChars} character description that says what you do and which area of ${s.profile.address?.locality ?? "the city"} you serve.`,
        ],
      };
    }
    const len = [...text].length;
    const goodLength = len >= T.descriptionMinChars && len <= T.descriptionMaxChars;
    const hasServices = mentions(text, serviceWords(s));
    const area = areaWords(s);
    const hasArea = area.length > 0 && mentions(text, area);
    const fixes: string[] = [];
    if (!goodLength) {
      fixes.push(
        len < T.descriptionMinChars
          ? `Lengthen the description to at least ${T.descriptionMinChars} characters.`
          : `Shorten the description to under ${T.descriptionMaxChars} characters.`,
      );
    }
    if (!hasServices) fixes.push("Name your main services or products in the description.");
    if (!hasArea && area.length) fixes.push(`Mention the area you serve (${area[0]}).`);
    return {
      parts: [
        { share: 0.4, earned: 1 },
        { share: 0.3, earned: goodLength ? 1 : 0 },
        { share: 0.15, earned: hasServices ? 1 : 0 },
        { share: 0.15, earned: hasArea ? 1 : 0 },
      ],
      facts: [
        `Description is ${plural(len, "character")}${goodLength ? "" : ` (aim for ${T.descriptionMinChars}–${T.descriptionMaxChars})`}.`,
        hasServices ? "Mentions services." : "Doesn't mention services.",
        hasArea ? "Mentions the area." : "Doesn't mention the area.",
      ],
      fixes,
    };
  },

  categories(s) {
    const primary = s.profile.primaryCategory;
    const extra = s.profile.additionalCategories.length;
    const fixes: string[] = [];
    if (!primary) fixes.push("Set the primary category that best describes the business.");
    if (extra < T.secondaryCategories) {
      fixes.push(
        `Add ${T.secondaryCategories - extra} more relevant secondary ${T.secondaryCategories - extra === 1 ? "category" : "categories"}.`,
      );
    }
    return {
      parts: [
        { share: 0.5, earned: primary ? 1 : 0 },
        { share: 0.5, earned: ratio(extra, T.secondaryCategories) },
      ],
      facts: [
        primary ? `Primary: ${primary.displayName}.` : "No primary category.",
        `${plural(extra, "secondary category", "secondary categories")}.`,
      ],
      fixes,
    };
  },

  hours(s, now) {
    const days = new Set(s.profile.regularHours.map((h) => h.day)).size;
    const until = now + T.holidayLookaheadDays * DAY;
    const today = new Date(now).toISOString().slice(0, 10);
    const untilDay = new Date(until).toISOString().slice(0, 10);
    const special = s.profile.specialHours.filter((h) => h.date >= today && h.date <= untilDay);
    const holidays = upcomingHolidays(now);
    const fixes: string[] = [];
    if (!days) fixes.push("Set regular opening hours for each day you're open.");
    if (!special.length) {
      fixes.push(
        holidays.length
          ? `Set holiday hours for ${holidays.map((h) => `${h.name} (${shortDate.format(new Date(`${h.date}T00:00:00Z`))})`).join(", ")}.`
          : `Set special hours for any day in the next ${T.holidayLookaheadDays} days when your hours change.`,
      );
    }
    return {
      parts: [
        { share: 0.6, earned: days ? 1 : 0 },
        { share: 0.4, earned: special.length ? 1 : 0 },
      ],
      facts: [
        days ? `Open ${plural(days, "day")} a week.` : "No opening hours set.",
        special.length
          ? `${plural(special.length, "special-hours date")} set for the coming weeks.`
          : "No holiday hours set for the coming weeks.",
      ],
      fixes,
    };
  },

  contact(s) {
    const phone = Boolean(s.profile.phone);
    const site = Boolean(s.profile.websiteUri);
    const fixes: string[] = [];
    if (!phone) fixes.push("Add a phone number customers can call.");
    if (!site) {
      fixes.push("Add a website link (a simple one-page site or a WhatsApp catalogue link works).");
    }
    return {
      parts: [
        { share: 0.5, earned: phone ? 1 : 0 },
        { share: 0.5, earned: site ? 1 : 0 },
      ],
      facts: [phone ? "Phone set." : "No phone number.", site ? "Website set." : "No website."],
      fixes,
    };
  },

  photos(s) {
    const p = s.photos;
    const fixes: string[] = [];
    if (p.total < T.photosTotal) {
      fixes.push(
        `Add ${T.photosTotal - p.total} more photos (shop front, inside, products, team at work).`,
      );
    }
    if (p.last30Days < 1) fixes.push("Add at least one new photo every month.");
    if (!p.hasLogo) fixes.push("Upload the business logo.");
    if (!p.hasCover) fixes.push("Set a cover photo.");
    return {
      parts: [
        { share: 0.4, earned: ratio(p.total, T.photosTotal) },
        { share: 0.3, earned: p.last30Days >= 1 ? 1 : 0 },
        { share: 0.15, earned: p.hasLogo ? 1 : 0 },
        { share: 0.15, earned: p.hasCover ? 1 : 0 },
      ],
      facts: [
        `${plural(p.total, "photo")}, ${nf.format(p.last30Days)} in the last ${T.photoRecentDays} days.`,
        `Logo ${p.hasLogo ? "set" : "missing"}, cover ${p.hasCover ? "set" : "missing"}.`,
      ],
      fixes,
    };
  },

  posts(s) {
    const p = s.posts;
    const fixes: string[] = [];
    if (p.last7Days < 1) fixes.push("Publish a post this week.");
    if (p.last30Days < T.postsLast30Days) {
      fixes.push(`Keep to about one post a week (${T.postsLast30Days} a month).`);
    }
    return {
      parts: [
        { share: 0.5, earned: p.last7Days >= 1 ? 1 : 0 },
        { share: 0.5, earned: ratio(p.last30Days, T.postsLast30Days) },
      ],
      facts: [
        `${plural(p.last7Days, "post")} in the last 7 days, ${nf.format(p.last30Days)} in the last 30.`,
      ],
      fixes,
    };
  },

  reviews(s) {
    const r = s.reviews;
    const ratingEarned =
      r.average === null
        ? 0
        : Math.max(0, Math.min(1, (r.average - T.ratingFloor) / (T.avgRating - T.ratingFloor)));
    const fixes: string[] = [];
    if (r.total < T.reviewsCount) {
      fixes.push(
        "Ask every customer for a review with the review link or QR code (same link for everyone).",
      );
    }
    if (r.average !== null && r.average < T.avgRating) {
      fixes.push(
        "Reply to unhappy reviews, fix what they point out, and keep asking all customers for reviews.",
      );
    }
    return {
      parts: [
        { share: 0.5, earned: ratio(r.total, T.reviewsCount) },
        { share: 0.5, earned: ratingEarned },
      ],
      facts: [
        `${plural(r.total, "review")} (target ${T.reviewsCount}), average ${r.average === null ? "—" : `★ ${r.average}`} (target ${T.avgRating}).`,
      ],
      fixes,
    };
  },

  replies(s) {
    const r = s.reviews;
    if (r.last90Days === 0) {
      return {
        parts: [{ share: 1, earned: 1 }],
        facts: ["No reviews in the last 90 days to reply to."],
        fixes: [],
      };
    }
    const rate = r.replyRateLast90Days ?? 0;
    const median = r.medianReplyHoursLast90Days;
    const fast = median !== null && median <= T.medianReplyHours;
    const fixes: string[] = [];
    if (rate < T.replyRate) {
      fixes.push(
        `Reply to every review — ${plural(r.last90Days - r.repliedLast90Days, "review")} from the last 90 days ${r.last90Days - r.repliedLast90Days === 1 ? "has" : "have"} no reply.`,
      );
    }
    if (!fast) fixes.push(`Reply within ${T.medianReplyHours} hours of a new review.`);
    return {
      parts: [
        { share: 0.7, earned: ratio(rate, T.replyRate) },
        { share: 0.3, earned: fast ? 1 : 0 },
      ],
      facts: [
        `${Math.round(rate * 100)}% of the last 90 days' reviews have a reply (target ${Math.round(T.replyRate * 100)}%).`,
        median === null
          ? "No replies yet."
          : `Typical reply time ${Math.round(median)} h (target ${T.medianReplyHours} h).`,
      ],
      fixes,
    };
  },

  services(s) {
    const n = s.profile.services.length;
    return {
      parts: [{ share: 1, earned: ratio(n, T.services) }],
      facts: [`${plural(n, "service")} listed.`],
      fixes:
        n < T.services
          ? [`List at least ${T.services} services or products customers search for.`]
          : [],
    };
  },

  attributes(s) {
    const n = s.profile.attributes.length;
    return {
      parts: [{ share: 1, earned: ratio(n, T.attributes) }],
      facts: [`${plural(n, "attribute")} filled.`],
      fixes:
        n < T.attributes
          ? ["Fill in attributes such as UPI/card payments, wheelchair access and appointments."]
          : [],
    };
  },
};

function statusOf(points: number, max: number): AuditStatus {
  if (points >= max) return "pass";
  return points * 2 >= max ? "warn" : "fail";
}

/** Score one snapshot. `now` defaults to when the snapshot was taken, so re-scoring is stable. */
export function auditSnapshot(snapshot: LocationSnapshot, now?: Date): AuditResult {
  const at = (now ?? new Date(snapshot.syncedAt)).getTime();
  const items = (Object.keys(AUDIT_WEIGHTS) as AuditCheckKey[]).map((key) => {
    const maxPoints = AUDIT_WEIGHTS[key];
    const { parts, facts, fixes } = CHECKS[key](snapshot, at);
    const fraction = parts.reduce((t, p) => t + p.share * p.earned, 0);
    const points = Math.round(maxPoints * fraction);
    const status = statusOf(points, maxPoints);
    return {
      key,
      title: CHECK_TITLES[key],
      status,
      points,
      maxPoints,
      pointsLost: maxPoints - points,
      facts: facts.join(" "),
      fix: status === "pass" ? "" : fixes.join(" "),
      rank: 0,
    } satisfies AuditItem;
  });

  // Biggest win first; ties go to the heavier check, then a fixed order.
  const order = Object.keys(AUDIT_WEIGHTS);
  items.sort(
    (a, b) =>
      b.pointsLost - a.pointsLost ||
      b.maxPoints - a.maxPoints ||
      order.indexOf(a.key) - order.indexOf(b.key),
  );
  items.forEach((item, i) => (item.rank = i + 1));

  return { score: items.reduce((t, i) => t + i.points, 0), items };
}

/**
 * Google Business Profile API responses → our own shapes (src/lib/gbp/types.ts). Pure, so
 * every mapping is unit-tested with sample payloads and the provider stays thin.
 */
import type {
  DailyMetrics,
  DayOfWeek,
  GbpLocalPost,
  GbpLocation,
  GbpMedia,
  GbpReview,
  MediaCategory,
} from "../types";

// ───────────── Raw shapes (only the fields we read) ─────────────

interface GDate {
  year?: number;
  month?: number;
  day?: number;
}
interface GTime {
  hours?: number;
  minutes?: number;
}
export interface RawLocation {
  name: string; // "locations/123"
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  categories?: {
    primaryCategory?: { name: string; displayName?: string };
    additionalCategories?: { name: string; displayName?: string }[];
  };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  websiteUri?: string;
  regularHours?: {
    periods?: { openDay?: DayOfWeek; openTime?: GTime; closeDay?: DayOfWeek; closeTime?: GTime }[];
  };
  specialHours?: { specialHourPeriods?: { startDate?: GDate; closed?: boolean }[] };
  serviceItems?: {
    structuredServiceItem?: { serviceTypeId?: string; description?: string };
    freeFormServiceItem?: { label?: { displayName?: string } };
  }[];
  profile?: { description?: string };
  openInfo?: { openingDate?: GDate };
  metadata?: { placeId?: string; hasVoiceOfMerchant?: boolean };
  latlng?: { latitude?: number; longitude?: number };
}
export interface RawAttribute {
  name: string; // "attributes/has_wheelchair_accessible_entrance" or "locations/1/attributes/…"
  values?: unknown[];
  repeatedEnumValue?: { setValues?: string[] };
}
export interface RawReview {
  name: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE" | "STAR_RATING_UNSPECIFIED";
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}
export interface RawMedia {
  name: string;
  locationAssociation?: { category?: string };
  createTime?: string;
}
export interface RawLocalPost {
  name: string;
  summary?: string;
  topicType?: string;
  state?: string;
  createTime?: string;
}
export interface RawMultiDailyMetrics {
  multiDailyMetricTimeSeries?: {
    dailyMetricTimeSeries?: {
      dailyMetric?: string;
      timeSeries?: { datedValues?: { date?: GDate; value?: string }[] };
    }[];
  }[];
}

// The fields getLocation/listLocations ask for (one read mask, so both see the same data).
export const LOCATION_READ_MASK = [
  "name",
  "title",
  "phoneNumbers",
  "categories",
  "storefrontAddress",
  "websiteUri",
  "regularHours",
  "specialHours",
  "serviceItems",
  "profile",
  "openInfo",
  "metadata",
  "latlng",
].join(",");

export const DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
] as const;

// ───────────── Helpers ─────────────

const pad = (n: number | undefined) => String(n ?? 0).padStart(2, "0");
const hhmm = (t: GTime | undefined) => `${pad(t?.hours)}:${pad(t?.minutes)}`;
export const isoDate = (d: GDate | undefined): string | null =>
  d?.year && d.month && d.day ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : null;

/** "job_type_id:solar_panel_installation" → "Solar panel installation" */
export function serviceTypeLabel(id: string): string {
  const raw = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  const words = raw.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

/** Google attribute ids → our attribute keys (src/config/attributes.ts). Others keep their id. */
const ATTRIBUTE_KEYS: Record<string, string> = {
  pay_mobile_nfc: "accepts_nfc",
  pay_credit_card: "accepts_cards",
  pay_debit_card: "accepts_cards",
  pay_cash_only: "accepts_cash",
  has_wheelchair_accessible_entrance: "wheelchair_accessible",
  has_wheelchair_accessible_parking: "wheelchair_parking",
  has_wheelchair_accessible_restroom: "wheelchair_restroom",
  has_wheelchair_accessible_seating: "wheelchair_seating",
  has_restroom: "restroom",
  has_onsite_services: "onsite_services",
  has_online_appointments: "online_appointments",
  offers_online_estimates: "online_estimates",
  has_delivery: "home_delivery",
  is_owned_by_women: "women_owned",
  has_parking_free: "free_parking",
};

/** Attributes that are switched on, as our keys, without duplicates. */
export function activeAttributes(raw: RawAttribute[]): string[] {
  const out = new Set<string>();
  for (const a of raw) {
    const id = a.name.slice(a.name.lastIndexOf("/") + 1);
    const values = a.values ?? [];
    const enumSet = a.repeatedEnumValue?.setValues ?? [];
    if (id === "wi_fi") {
      if (values.includes("free_wi_fi") || enumSet.includes("free_wi_fi")) out.add("free_wifi");
      continue;
    }
    const on = values.some((v) => v === true) || enumSet.length > 0;
    if (on) out.add(ATTRIBUTE_KEYS[id] ?? id);
  }
  return [...out];
}

// ───────────── Mappers ─────────────

/** "locations/123" only — anything else is refused before it reaches a URL. */
export function assertLocationName(name: string): string {
  if (!/^locations\/[\w-]+$/.test(name)) throw new Error(`Not a location name: ${name}`);
  return name;
}

/** v4 endpoints (reviews, media, posts) want "accounts/A/locations/L". */
export function v4LocationPath(accountName: string, locationName: string): string {
  if (!/^accounts\/[\w-]+$/.test(accountName)) {
    throw new Error(`Not an account name: ${accountName}`);
  }
  return `${accountName}/${assertLocationName(locationName)}`;
}

export function toGbpLocation(
  raw: RawLocation,
  accountName: string,
  attributes: RawAttribute[] = [],
): GbpLocation {
  const cats = raw.categories;
  const a = raw.storefrontAddress;
  const services = (raw.serviceItems ?? [])
    .map(
      (s) =>
        s.freeFormServiceItem?.label?.displayName ??
        (s.structuredServiceItem?.serviceTypeId
          ? serviceTypeLabel(s.structuredServiceItem.serviceTypeId)
          : null),
    )
    .filter((x): x is string => Boolean(x?.trim()));
  return {
    name: raw.name,
    accountName,
    title: raw.title ?? "Unnamed business",
    placeId: raw.metadata?.placeId ?? null,
    verified: Boolean(raw.metadata?.hasVoiceOfMerchant),
    primaryCategory: cats?.primaryCategory
      ? {
          id: cats.primaryCategory.name,
          displayName: cats.primaryCategory.displayName ?? cats.primaryCategory.name,
        }
      : null,
    additionalCategories: (cats?.additionalCategories ?? []).map((c) => ({
      id: c.name,
      displayName: c.displayName ?? c.name,
    })),
    phone: raw.phoneNumbers?.primaryPhone ?? null,
    websiteUri: raw.websiteUri ?? null,
    address: a
      ? {
          addressLines: a.addressLines ?? [],
          locality: a.locality ?? "",
          administrativeArea: a.administrativeArea ?? "",
          postalCode: a.postalCode ?? "",
          regionCode: a.regionCode ?? "IN",
        }
      : null,
    description: raw.profile?.description ?? null,
    regularHours: (raw.regularHours?.periods ?? [])
      .filter((p) => p.openDay)
      .map((p) => ({
        day: p.openDay!,
        open: hhmm(p.openTime),
        close: p.closeTime ? hhmm(p.closeTime) : "24:00",
      })),
    specialHours: (raw.specialHours?.specialHourPeriods ?? [])
      .map((s) => ({ date: isoDate(s.startDate), closed: Boolean(s.closed) }))
      .filter((s): s is { date: string; closed: boolean } => s.date != null),
    services: [...new Set(services)],
    attributes: activeAttributes(attributes),
    openingDate: isoDate(raw.openInfo?.openingDate),
  };
}

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const;

/** Google appends "(Translated by Google) …" to some comments; keep the owner's original. */
export function originalComment(comment: string | undefined): string | null {
  if (!comment?.trim()) return null;
  const original = comment.split(/\n\n\(Original\)\n/);
  if (original.length === 2) return original[1].trim();
  return comment.replace(/\s*\(Translated by Google\)[\s\S]*$/, "").trim() || comment.trim();
}

export function toGbpReview(raw: RawReview): GbpReview | null {
  const stars =
    raw.starRating && raw.starRating in STARS ? STARS[raw.starRating as keyof typeof STARS] : null;
  if (!stars || !raw.createTime) return null;
  return {
    name: raw.name,
    reviewer: raw.reviewer?.isAnonymous
      ? "A Google user"
      : (raw.reviewer?.displayName ?? "A Google user"),
    starRating: stars,
    comment: originalComment(raw.comment),
    createTime: raw.createTime,
    reply: raw.reviewReply?.comment
      ? {
          comment: raw.reviewReply.comment,
          updateTime: raw.reviewReply.updateTime ?? raw.createTime,
        }
      : null,
  };
}

const MEDIA_CATEGORIES = new Set<MediaCategory>([
  "COVER",
  "LOGO",
  "EXTERIOR",
  "INTERIOR",
  "PRODUCT",
  "AT_WORK",
  "TEAM",
  "ADDITIONAL",
]);

export function toGbpMedia(raw: RawMedia): GbpMedia | null {
  if (!raw.createTime) return null;
  const c = raw.locationAssociation?.category as MediaCategory | undefined;
  return {
    name: raw.name,
    category: c && MEDIA_CATEGORIES.has(c) ? c : "ADDITIONAL",
    createTime: raw.createTime,
  };
}

export function toGbpLocalPost(raw: RawLocalPost): GbpLocalPost | null {
  if (!raw.createTime) return null;
  const topic = raw.topicType === "OFFER" || raw.topicType === "EVENT" ? raw.topicType : "STANDARD";
  const state = raw.state === "LIVE" || raw.state === "REJECTED" ? raw.state : "PROCESSING";
  return {
    name: raw.name,
    summary: raw.summary ?? "",
    topicType: topic,
    state,
    createTime: raw.createTime,
  };
}

/** Google's per-metric series → one row per day with our five numbers. */
export function toDailyMetrics(raw: RawMultiDailyMetrics): DailyMetrics[] {
  const byDay = new Map<string, DailyMetrics>();
  const row = (date: string) => {
    let r = byDay.get(date);
    if (!r) {
      r = {
        date,
        impressionsSearch: 0,
        impressionsMaps: 0,
        calls: 0,
        directionRequests: 0,
        websiteClicks: 0,
      };
      byDay.set(date, r);
    }
    return r;
  };
  for (const group of raw.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      for (const dv of series.timeSeries?.datedValues ?? []) {
        const date = isoDate(dv.date);
        if (!date) continue;
        const n = Number(dv.value ?? 0) || 0;
        const r = row(date);
        switch (series.dailyMetric) {
          case "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
          case "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
            r.impressionsSearch += n;
            break;
          case "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
          case "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
            r.impressionsMaps += n;
            break;
          case "CALL_CLICKS":
            r.calls += n;
            break;
          case "BUSINESS_DIRECTION_REQUESTS":
            r.directionRequests += n;
            break;
          case "WEBSITE_CLICKS":
            r.websiteClicks += n;
            break;
        }
      }
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Our own shapes for Google Business Profile data. They follow the official API's
 * resource names (accounts/…, locations/…) but keep only what the product uses, so the
 * mock and the real Google implementation return exactly the same thing.
 */
import type { ListingEdit } from "./listing-edit";

export type GbpProviderKind = "mock" | "google";
/** agency = our team's Google account (clients add us as Manager); owner = owner's own account. */
export type ConnectMode = "agency" | "owner";

export type DayOfWeek =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface GbpCategory {
  id: string; // e.g. "gcid:solar_energy_company"
  displayName: string;
}

export interface GbpAddress {
  addressLines: string[];
  locality: string;
  administrativeArea: string;
  postalCode: string;
  regionCode: string;
}

export interface GbpLocation {
  name: string; // "locations/123"
  accountName: string; // "accounts/456"
  title: string;
  placeId: string | null;
  verified: boolean;
  primaryCategory: GbpCategory | null;
  additionalCategories: GbpCategory[];
  phone: string | null;
  websiteUri: string | null;
  address: GbpAddress | null;
  description: string | null;
  regularHours: { day: DayOfWeek; open: string; close: string }[];
  specialHours: { date: string; closed: boolean }[];
  services: string[];
  attributes: string[];
  openingDate: string | null;
}

export type MediaCategory =
  "COVER" | "LOGO" | "EXTERIOR" | "INTERIOR" | "PRODUCT" | "AT_WORK" | "TEAM" | "ADDITIONAL";

export interface GbpMedia {
  name: string;
  category: MediaCategory;
  createTime: string;
}

export interface GbpReview {
  name: string; // ".../reviews/abc"
  reviewer: string;
  starRating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createTime: string;
  reply: { comment: string; updateTime: string } | null;
}

export interface GbpLocalPost {
  name: string;
  summary: string;
  topicType: "STANDARD" | "OFFER" | "EVENT";
  state: "LIVE" | "PROCESSING" | "REJECTED";
  createTime: string;
}

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  impressionsSearch: number;
  impressionsMaps: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
}

/** What a stored connection gives the provider to act on Google's behalf. */
export interface GbpCredentials {
  accountName: string;
  refreshToken: string | null; // null for sample connections
}

export interface ConnectedAccount {
  accountName: string;
  label: string;
  refreshToken: string | null;
}

export interface GbpProvider {
  readonly kind: GbpProviderKind;
  /** Where to send the user to grant access (Google's consent page, or our sample page). */
  authorizationUrl(input: { state: string; mode: ConnectMode; appUrl: string }): string;
  /** Turn the code from the consent redirect into a connected account. */
  exchangeCode(input: {
    code: string;
    mode: ConnectMode;
    appUrl: string;
  }): Promise<ConnectedAccount>;
  listLocations(creds: GbpCredentials): Promise<GbpLocation[]>;
  getLocation(creds: GbpCredentials, locationName: string): Promise<GbpLocation>;
  listMedia(creds: GbpCredentials, locationName: string): Promise<GbpMedia[]>;
  listReviews(creds: GbpCredentials, locationName: string): Promise<GbpReview[]>;
  listLocalPosts(creds: GbpCredentials, locationName: string): Promise<GbpLocalPost[]>;
  /** Inclusive date range, YYYY-MM-DD. */
  getDailyMetrics(
    creds: GbpCredentials,
    locationName: string,
    range: { start: string; end: string },
  ): Promise<DailyMetrics[]>;
  /** Change phone, website, description and/or opening hours on the live profile. */
  updateLocation(creds: GbpCredentials, locationName: string, edit: ListingEdit): Promise<void>;
  /** Add a photo to the profile from a public link Google can fetch. */
  addPhoto(
    creds: GbpCredentials,
    locationName: string,
    photo: { sourceUrl: string; category: MediaCategory },
  ): Promise<{ name: string }>;
  /** Post (or replace) the owner's public reply to a review. Returns the reply as stored. */
  replyToReview(
    creds: GbpCredentials,
    reviewName: string,
    comment: string,
  ): Promise<{ comment: string; updateTime: string }>;
  /** Publish a post on the profile. Only ever called for posts the owner approved. */
  createLocalPost(
    creds: GbpCredentials,
    locationName: string,
    post: NewLocalPost,
  ): Promise<{ name: string; state: GbpLocalPost["state"] }>;
}

export type PostCtaType = "CALL" | "LEARN_MORE" | "BOOK" | "ORDER" | "SHOP" | "SIGN_UP";

export interface NewLocalPost {
  summary: string;
  /** BCP-47, e.g. "en" or "hi". */
  languageCode: string;
  /** CALL uses the profile's phone; the others need an https URL. */
  cta: { type: PostCtaType; url: string | null } | null;
  /** A short-lived public link Google fetches the photo from, or null for text only. */
  photoUrl: string | null;
}

export class GbpError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "auth" | "not_enabled" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "GbpError";
  }
}

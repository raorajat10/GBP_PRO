import "server-only";
import {
  type DailyMetrics,
  GbpError,
  type ConnectedAccount,
  type ConnectMode,
  type GbpCredentials,
  type GbpLocalPost,
  type GbpLocation,
  type GbpMedia,
  type GbpProvider,
  type GbpReview,
  type NewLocalPost,
} from "../types";
import {
  classifyGoogleError,
  exchangeGoogleCode,
  GBP_SCOPE,
  GoogleApiError,
  googleAuthorizationUrl,
  type GoogleOAuthConfig,
} from "./oauth";
import {
  DAILY_METRICS,
  LOCATION_READ_MASK,
  assertLocationName,
  toDailyMetrics,
  toGbpLocalPost,
  toGbpLocation,
  toGbpMedia,
  toGbpReview,
  v4LocationPath,
  type RawAttribute,
  type RawLocalPost,
  type RawLocation,
  type RawMedia,
  type RawMultiDailyMetrics,
  type RawReview,
} from "./mappers";

/**
 * The real Google Business Profile provider (official APIs, OAuth "business.manage").
 * Same interface as the sample provider, so the rest of the app doesn't change.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERFORMANCE = "https://businessprofileperformance.googleapis.com/v1";

const MAX_REVIEW_PAGES = 40; // 50 per page → up to 2,000 reviews per sync
const MAX_MEDIA_PAGES = 5;
const MAX_POST_PAGES = 3;
const MAX_ACCOUNTS = 20;

/** Access tokens last an hour; reuse them across calls within one server instance. */
const accessTokens = new Map<string, { token: string; expiresAt: number }>();

function toGbpError(e: unknown): GbpError {
  if (e instanceof GbpError) return e;
  if (e instanceof GoogleApiError) {
    const kind =
      e.kind === "auth" || e.kind === "no_permission"
        ? "auth"
        : e.kind === "not_approved" || e.kind === "api_disabled"
          ? "not_enabled"
          : "unknown";
    return new GbpError(e.message, kind);
  }
  return new GbpError("Couldn't reach Google. Try again.");
}

export class GoogleGbpProvider implements GbpProvider {
  readonly kind = "google" as const;
  constructor(
    private readonly cfg: GoogleOAuthConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  authorizationUrl(input: { state: string; mode: ConnectMode; appUrl: string }): string {
    return googleAuthorizationUrl(this.cfg, { state: input.state, appUrl: input.appUrl });
  }

  async exchangeCode(input: {
    code: string;
    mode: ConnectMode;
    appUrl: string;
  }): Promise<ConnectedAccount> {
    try {
      const tokens = await exchangeGoogleCode(this.cfg, input, this.fetchImpl);
      if (!tokens.grantedScopes.includes(GBP_SCOPE)) {
        throw new GbpError(
          "The Business Profile permission wasn't granted. Connect again and tick the permission on Google's screen.",
          "auth",
        );
      }
      if (!tokens.refreshToken) {
        throw new GbpError(
          "Google didn't give us lasting access. Remove the app in your Google account's security settings and connect again.",
          "auth",
        );
      }
      const accounts = await this.accounts(tokens.accessToken);
      if (!accounts.length) {
        throw new GbpError("This Google account doesn't manage any Business Profile.", "not_found");
      }
      const primary = accounts.find((a) => a.type === "PERSONAL") ?? accounts[0];
      return {
        accountName: primary.name,
        label: tokens.email ?? primary.accountName ?? primary.name,
        refreshToken: tokens.refreshToken,
      };
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async listLocations(creds: GbpCredentials): Promise<GbpLocation[]> {
    try {
      const token = await this.accessToken(creds);
      const out: GbpLocation[] = [];
      for (const account of (await this.accounts(token)).slice(0, MAX_ACCOUNTS)) {
        const raws = await this.pages<RawLocation>(
          `${INFO}/${account.name}/locations?readMask=${LOCATION_READ_MASK}&pageSize=100`,
          token,
          "locations",
          10,
        );
        out.push(...raws.map((r) => toGbpLocation(r, account.name)));
      }
      return out;
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async getLocation(creds: GbpCredentials, locationName: string): Promise<GbpLocation> {
    try {
      const location = assertLocationName(locationName);
      const token = await this.accessToken(creds);
      const raw = (await this.get(
        `${INFO}/${location}?readMask=${LOCATION_READ_MASK}`,
        token,
      )) as RawLocation;
      // Attributes are a separate call; a failure there shouldn't block the sync.
      const attrs = await this.get(`${INFO}/${location}/attributes`, token)
        .then((r) => (r as { attributes?: RawAttribute[] }).attributes ?? [])
        .catch(() => [] as RawAttribute[]);
      return toGbpLocation(raw, creds.accountName, attrs);
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async listMedia(creds: GbpCredentials, locationName: string): Promise<GbpMedia[]> {
    try {
      const token = await this.accessToken(creds);
      const raws = await this.pages<RawMedia>(
        `${V4}/${v4LocationPath(creds.accountName, locationName)}/media?pageSize=100`,
        token,
        "mediaItems",
        MAX_MEDIA_PAGES,
      );
      return raws.map(toGbpMedia).filter((m): m is GbpMedia => m != null);
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async listReviews(creds: GbpCredentials, locationName: string): Promise<GbpReview[]> {
    try {
      const token = await this.accessToken(creds);
      const raws = await this.pages<RawReview>(
        `${V4}/${v4LocationPath(creds.accountName, locationName)}/reviews?pageSize=50`,
        token,
        "reviews",
        MAX_REVIEW_PAGES,
      );
      return raws.map(toGbpReview).filter((r): r is GbpReview => r != null);
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async listLocalPosts(creds: GbpCredentials, locationName: string): Promise<GbpLocalPost[]> {
    try {
      const token = await this.accessToken(creds);
      const raws = await this.pages<RawLocalPost>(
        `${V4}/${v4LocationPath(creds.accountName, locationName)}/localPosts?pageSize=100`,
        token,
        "localPosts",
        MAX_POST_PAGES,
      );
      return raws.map(toGbpLocalPost).filter((p): p is GbpLocalPost => p != null);
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async getDailyMetrics(
    creds: GbpCredentials,
    locationName: string,
    range: { start: string; end: string },
  ): Promise<DailyMetrics[]> {
    try {
      const location = assertLocationName(locationName);
      const token = await this.accessToken(creds);
      const [sy, sm, sd] = range.start.split("-").map(Number);
      const [ey, em, ed] = range.end.split("-").map(Number);
      const q = new URLSearchParams();
      for (const m of DAILY_METRICS) q.append("dailyMetrics", m);
      q.set("dailyRange.startDate.year", String(sy));
      q.set("dailyRange.startDate.month", String(sm));
      q.set("dailyRange.startDate.day", String(sd));
      q.set("dailyRange.endDate.year", String(ey));
      q.set("dailyRange.endDate.month", String(em));
      q.set("dailyRange.endDate.day", String(ed));
      const raw = (await this.get(
        `${PERFORMANCE}/${location}:fetchMultiDailyMetricsTimeSeries?${q.toString()}`,
        token,
      )) as RawMultiDailyMetrics;
      return toDailyMetrics(raw);
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async replyToReview(
    creds: GbpCredentials,
    reviewName: string,
    comment: string,
  ): Promise<{ comment: string; updateTime: string }> {
    try {
      // Only well-formed review names, and only under this credential's account.
      if (!/^accounts\/[\w-]+\/locations\/[\w-]+\/reviews\/[\w-]+$/.test(reviewName)) {
        throw new GbpError("Review not found.", "not_found");
      }
      if (!reviewName.startsWith(`${creds.accountName}/`)) {
        throw new GbpError("This review belongs to a different Google account.", "auth");
      }
      const token = await this.accessToken(creds);
      const res = await this.fetchImpl(`${V4}/${reviewName}/reply`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        comment?: string;
        updateTime?: string;
        error?: { message?: string };
      };
      if (res.status === 400) {
        throw new GbpError(`Google refused the reply: ${data.error?.message ?? "invalid reply"}`);
      }
      if (res.status === 404) throw new GbpError("Google couldn't find this review.", "not_found");
      if (!res.ok) throw classifyGoogleError(res.status, data);
      return {
        comment: data.comment ?? comment,
        updateTime: data.updateTime ?? new Date().toISOString(),
      };
    } catch (e) {
      throw toGbpError(e);
    }
  }

  async createLocalPost(
    creds: GbpCredentials,
    locationName: string,
    post: NewLocalPost,
  ): Promise<{ name: string; state: GbpLocalPost["state"] }> {
    try {
      const token = await this.accessToken(creds);
      const body = {
        languageCode: post.languageCode,
        summary: post.summary,
        topicType: "STANDARD",
        ...(post.cta
          ? {
              callToAction:
                post.cta.type === "CALL"
                  ? { actionType: "CALL" }
                  : { actionType: post.cta.type, url: post.cta.url },
            }
          : {}),
        ...(post.photoUrl ? { media: [{ mediaFormat: "PHOTO", sourceUrl: post.photoUrl }] } : {}),
      };
      const res = await this.fetchImpl(
        `${V4}/${v4LocationPath(creds.accountName, locationName)}/localPosts`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        },
      );
      const data = (await res.json().catch(() => ({}))) as RawLocalPost & {
        error?: { message?: string };
      };
      if (res.status === 400) {
        // Google says what it rejected (for example a phone number in the text): pass it on.
        throw new GbpError(
          `Google refused the post: ${data.error?.message ?? "invalid post"}`,
          "unknown",
        );
      }
      if (!res.ok) throw classifyGoogleError(res.status, data);
      const state = data.state === "LIVE" || data.state === "REJECTED" ? data.state : "PROCESSING";
      return { name: data.name, state };
    } catch (e) {
      throw toGbpError(e);
    }
  }

  // ───────────── plumbing ─────────────

  private async accessToken(creds: GbpCredentials): Promise<string> {
    if (!creds.refreshToken) {
      throw new GbpError(
        "This Google connection has no saved access. Connect Google again.",
        "auth",
      );
    }
    const cached = accessTokens.get(creds.refreshToken);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      // invalid_grant: the owner removed our access or changed their password.
      throw new GbpError(
        data.error === "invalid_grant"
          ? "Google access was removed for this account. Connect Google again."
          : "Couldn't refresh Google access. Try again.",
        "auth",
      );
    }
    accessTokens.set(creds.refreshToken, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });
    if (accessTokens.size > 500) accessTokens.clear();
    return data.access_token;
  }

  private async get(url: string, token: string): Promise<unknown> {
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) throw new GbpError("Google couldn't find that profile.", "not_found");
    if (!res.ok) throw classifyGoogleError(res.status, body);
    return body;
  }

  private async pages<T>(url: string, token: string, key: string, maxPages: number): Promise<T[]> {
    const out: T[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const u = new URL(url);
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      const body = (await this.get(u.toString(), token)) as Record<string, unknown>;
      out.push(...(((body[key] as T[]) ?? []) as T[]));
      pageToken = body.nextPageToken as string | undefined;
      if (!pageToken) break;
    }
    return out;
  }

  private async accounts(token: string) {
    const all = await this.pages<{ name: string; accountName?: string; type?: string }>(
      `${ACCOUNTS}/accounts?pageSize=20`,
      token,
      "accounts",
      5,
    );
    return all;
  }
}

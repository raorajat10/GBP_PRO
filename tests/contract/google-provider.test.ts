/**
 * The real Google provider against a fake Google (no network): runs the same contract as
 * the sample provider, plus Google-specific behaviour (token refresh, paging, errors).
 */
import { describe, expect, it } from "vitest";
import { GoogleGbpProvider } from "@/lib/gbp/google/provider";
import { GBP_SCOPE } from "@/lib/gbp/google/oauth";
import { gbpProviderContract } from "./gbp-provider.contract";

const cfg = { clientId: "id.apps.googleusercontent.com", clientSecret: "secret-secret" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const idToken = (email: string) =>
  `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;

const LOCATION = {
  name: "locations/222",
  title: "Alpha Solar",
  metadata: { placeId: "ChIJ1", hasVoiceOfMerchant: true },
};

/** A tiny fake of the Google endpoints we call. Records every URL. */
function fakeGoogle(opts: { refreshFails?: boolean } = {}) {
  const calls: string[] = [];
  const day = (offset: number) => {
    const d = new Date(Date.now() - offset * 86_400_000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.href === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(String(init?.body));
      if (body.get("grant_type") === "authorization_code") {
        return body.get("code") === "good"
          ? json({
              access_token: "at-1",
              refresh_token: "rt-1",
              id_token: idToken("owner@example.com"),
              scope: `openid email ${GBP_SCOPE}`,
            })
          : json({ error: "invalid_grant" }, 400);
      }
      return opts.refreshFails
        ? json({ error: "invalid_grant" }, 400)
        : json({ access_token: "at-2", expires_in: 3600 });
    }
    if (url.pathname === "/v1/accounts") {
      return json({ accounts: [{ name: "accounts/111", type: "PERSONAL", accountName: "Owner" }] });
    }
    if (url.pathname === "/v1/accounts/111/locations") return json({ locations: [LOCATION] });
    if (url.pathname === "/v1/locations/222") return json(LOCATION);
    if (url.pathname === "/v1/locations/222/attributes") return json({ attributes: [] });
    if (url.pathname === "/v4/accounts/111/locations/222/reviews") {
      // Two pages, to prove paging works.
      return url.searchParams.get("pageToken")
        ? json({
            reviews: [{ name: "r2", starRating: "THREE", createTime: "2026-10-01T00:00:00Z" }],
          })
        : json({
            reviews: [
              {
                name: "r1",
                reviewer: { displayName: "Asha" },
                starRating: "FIVE",
                comment: "Great",
                createTime: "2026-11-01T00:00:00Z",
                reviewReply: { comment: "Thanks", updateTime: "2026-11-02T00:00:00Z" },
              },
            ],
            nextPageToken: "p2",
          });
    }
    if (
      url.pathname === "/v4/accounts/111/locations/222/reviews/r1/reply" &&
      init?.method === "PUT"
    ) {
      const { comment } = JSON.parse(String(init.body)) as { comment: string };
      return comment.includes("http")
        ? json({ error: { message: "Links aren't allowed in replies." } }, 400)
        : json({ comment, updateTime: "2026-11-24T10:00:00Z" });
    }
    if (url.pathname === "/v4/accounts/111/locations/222/media") {
      return json({
        mediaItems: [
          {
            name: "m1",
            locationAssociation: { category: "LOGO" },
            createTime: "2026-01-01T00:00:00Z",
          },
        ],
      });
    }
    if (url.pathname === "/v4/accounts/111/locations/222/localPosts") {
      return json({
        localPosts: [
          { name: "p1", summary: "Hi", state: "LIVE", createTime: "2026-11-01T00:00:00Z" },
        ],
      });
    }
    if (url.pathname === "/v1/locations/222:fetchMultiDailyMetricsTimeSeries") {
      return json({
        multiDailyMetricTimeSeries: [
          {
            dailyMetricTimeSeries: [
              {
                dailyMetric: "CALL_CLICKS",
                timeSeries: { datedValues: [2, 3, 4].map((o) => ({ date: day(o), value: "2" })) },
              },
            ],
          },
        ],
      });
    }
    if (url.pathname.startsWith("/v1/locations/"))
      return json({ error: { status: "NOT_FOUND" } }, 404);
    return json({ error: { message: `unexpected ${url.pathname}` } }, 500);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

gbpProviderContract("google (fake Google)", async () => ({
  provider: new GoogleGbpProvider(cfg, fakeGoogle().fetchImpl),
  code: "good",
  mode: "owner",
}));

describe("google-specific behaviour", () => {
  it("connects with a refresh token and labels the account with the email", async () => {
    const p = new GoogleGbpProvider(cfg, fakeGoogle().fetchImpl);
    expect(await p.exchangeCode({ code: "good", mode: "owner", appUrl: "http://x" })).toEqual({
      accountName: "accounts/111",
      label: "owner@example.com",
      refreshToken: "rt-1",
    });
  });

  it("asks Google for offline access with the Business Profile scope", () => {
    const url = new URL(
      new GoogleGbpProvider(cfg).authorizationUrl({
        state: "s",
        mode: "owner",
        appUrl: "http://x",
      }),
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain(GBP_SCOPE);
  });

  it("pages through reviews and sends the metric range Google expects", async () => {
    const g = fakeGoogle();
    const p = new GoogleGbpProvider(cfg, g.fetchImpl);
    const creds = { accountName: "accounts/111", refreshToken: "rt-paging" };
    expect((await p.listReviews(creds, "locations/222")).map((r) => r.name)).toEqual(["r1", "r2"]);
    await p.getDailyMetrics(creds, "locations/222", { start: "2026-10-01", end: "2026-10-28" });
    const metricsCall = new URL(
      g.calls.find((c) => c.includes("fetchMultiDailyMetricsTimeSeries"))!,
    );
    expect(metricsCall.searchParams.getAll("dailyMetrics")).toHaveLength(7);
    expect(metricsCall.searchParams.get("dailyRange.startDate.month")).toBe("10");
    expect(metricsCall.searchParams.get("dailyRange.endDate.day")).toBe("28");
  });

  it("reuses the access token instead of refreshing on every call", async () => {
    const g = fakeGoogle();
    const p = new GoogleGbpProvider(cfg, g.fetchImpl);
    const creds = { accountName: "accounts/111", refreshToken: "rt-cache" };
    await p.listMedia(creds, "locations/222");
    await p.listLocalPosts(creds, "locations/222");
    expect(g.calls.filter((c) => c.includes("oauth2.googleapis.com/token"))).toHaveLength(1);
  });

  it("reports removed access as an auth error so the connection can be flagged", async () => {
    const p = new GoogleGbpProvider(cfg, fakeGoogle({ refreshFails: true }).fetchImpl);
    await expect(
      p.listReviews({ accountName: "accounts/111", refreshToken: "rt-revoked" }, "locations/222"),
    ).rejects.toMatchObject({
      kind: "auth",
      message: expect.stringMatching(/Connect Google again/),
    });
  });

  it("posts a review reply and passes on Google's reason when it refuses", async () => {
    const g = fakeGoogle();
    const p = new GoogleGbpProvider(cfg, g.fetchImpl);
    const creds = { accountName: "accounts/111", refreshToken: "rt-reply" };
    const review = "accounts/111/locations/222/reviews/r1";
    expect(await p.replyToReview(creds, review, "Thank you, Asha!")).toEqual({
      comment: "Thank you, Asha!",
      updateTime: "2026-11-24T10:00:00Z",
    });
    await expect(p.replyToReview(creds, review, "See http://x")).rejects.toThrow(
      /Google refused the reply: Links aren't allowed/,
    );
  });

  it("won't reply to reviews outside this account or with odd names", async () => {
    const g = fakeGoogle();
    const p = new GoogleGbpProvider(cfg, g.fetchImpl);
    const creds = { accountName: "accounts/111", refreshToken: "rt-reply2" };
    await expect(
      p.replyToReview(creds, "accounts/999/locations/222/reviews/r1", "Hi"),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      p.replyToReview(creds, "accounts/111/locations/222/reviews/../x", "Hi"),
    ).rejects.toMatchObject({ kind: "not_found" });
    expect(g.calls.some((c) => c.includes("/reply"))).toBe(false);
  });

  it("refuses malformed location names before calling Google", async () => {
    const g = fakeGoogle();
    const p = new GoogleGbpProvider(cfg, g.fetchImpl);
    await expect(
      p.listReviews({ accountName: "accounts/111", refreshToken: "rt-x" }, "locations/1/../../x"),
    ).rejects.toBeTruthy();
    expect(g.calls.some((c) => c.includes("/v4/"))).toBe(false);
  });
});

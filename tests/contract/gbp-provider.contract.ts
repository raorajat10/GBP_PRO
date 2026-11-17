/**
 * Behaviour every GbpProvider must have. The mock runs this today; the real Google
 * provider must pass the same suite (against a test profile) before we switch to it.
 */
import { describe, expect, it } from "vitest";
import { GbpError, type ConnectMode, type GbpProvider } from "@/lib/gbp/types";

export function gbpProviderContract(
  name: string,
  setup: () => Promise<{ provider: GbpProvider; code: string; mode: ConnectMode }>,
) {
  describe(`GbpProvider contract: ${name}`, () => {
    async function connected() {
      const { provider, code, mode } = await setup();
      const account = await provider.exchangeCode({ code, mode, appUrl: "http://localhost:3000" });
      const creds = { accountName: account.accountName, refreshToken: account.refreshToken };
      const locations = await provider.listLocations(creds);
      return { provider, account, creds, locations };
    }

    it("builds an authorization URL that carries the state", async () => {
      const { provider, mode } = await setup();
      const url = new URL(
        provider.authorizationUrl({ state: "abc123state", mode, appUrl: "http://localhost:3000" }),
      );
      expect(url.searchParams.get("state")).toBe("abc123state");
    });

    it("rejects an unknown authorization code", async () => {
      const { provider, mode } = await setup();
      await expect(
        provider.exchangeCode({ code: "definitely-wrong", mode, appUrl: "http://localhost:3000" }),
      ).rejects.toBeInstanceOf(GbpError);
    });

    it("lists the account's locations with official resource names", async () => {
      const { account, locations } = await connected();
      expect(account.accountName).toMatch(/^accounts\//);
      expect(locations.length).toBeGreaterThan(0);
      for (const l of locations) {
        expect(l.name).toMatch(/^locations\/[\w-]+$/);
        expect(l.accountName).toBe(account.accountName);
        expect(l.title.length).toBeGreaterThan(0);
      }
    });

    it("getLocation returns the same profile as the list", async () => {
      const { provider, creds, locations } = await connected();
      expect(await provider.getLocation(creds, locations[0].name)).toEqual(locations[0]);
    });

    it("refuses locations the account doesn't manage", async () => {
      const { provider, creds } = await connected();
      await expect(provider.getLocation(creds, "locations/0000000000")).rejects.toMatchObject({
        kind: "not_found",
      });
    });

    it("returns well-formed reviews (1–5 stars, replies after the review)", async () => {
      const { provider, creds, locations } = await connected();
      for (const l of locations) {
        for (const r of await provider.listReviews(creds, l.name)) {
          expect([1, 2, 3, 4, 5]).toContain(r.starRating);
          expect(Number.isNaN(Date.parse(r.createTime))).toBe(false);
          if (r.reply) expect(r.reply.updateTime >= r.createTime).toBe(true);
        }
      }
    });

    it("returns media and posts with valid timestamps", async () => {
      const { provider, creds, locations } = await connected();
      const l = locations[0];
      for (const m of await provider.listMedia(creds, l.name)) {
        expect(Number.isNaN(Date.parse(m.createTime))).toBe(false);
      }
      for (const p of await provider.listLocalPosts(creds, l.name)) {
        expect(["LIVE", "PROCESSING", "REJECTED"]).toContain(p.state);
      }
    });

    it("returns one row per day, within the range, never negative", async () => {
      const { provider, creds, locations } = await connected();
      const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const start = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
      const rows = await provider.getDailyMetrics(creds, locations[0].name, { start, end });
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.date)).size).toBe(rows.length);
      for (const r of rows) {
        expect(r.date >= start && r.date <= end).toBe(true);
        for (const v of [
          r.impressionsSearch,
          r.impressionsMaps,
          r.calls,
          r.directionRequests,
          r.websiteClicks,
        ]) {
          expect(Number.isInteger(v) && v >= 0).toBe(true);
        }
      }
    });
  });
}

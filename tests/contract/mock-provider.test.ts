import { describe, expect, it } from "vitest";
import { MockGbpProvider, METRICS_LAG_DAYS } from "@/lib/gbp/mock/provider";
import { gbpProviderContract } from "./gbp-provider.contract";

gbpProviderContract("mock (team account)", async () => ({
  provider: new MockGbpProvider(),
  code: "sample-team",
  mode: "agency",
}));

gbpProviderContract("mock (owner account)", async () => ({
  provider: new MockGbpProvider(),
  code: "sample-owner",
  mode: "owner",
}));

describe("mock-specific behaviour", () => {
  const now = new Date("2026-11-17T10:00:00Z");
  const team = { accountName: "accounts/sample-team", refreshToken: null };

  it("is deterministic: same day, same data", async () => {
    const a = new MockGbpProvider(now);
    const b = new MockGbpProvider(now);
    expect(await a.listReviews(team, "locations/9100000002")).toEqual(
      await b.listReviews(team, "locations/9100000002"),
    );
  });

  it("offers six sample profiles on the team account", async () => {
    expect(await new MockGbpProvider(now).listLocations(team)).toHaveLength(6);
  });

  it("gives every owner connection its own single profile", async () => {
    const p = new MockGbpProvider(now);
    const a1 = await p.exchangeCode({ code: "sample-owner", mode: "owner", appUrl: "x" });
    const a2 = await p.exchangeCode({ code: "sample-owner", mode: "owner", appUrl: "x" });
    const [l1] = await p.listLocations({ accountName: a1.accountName, refreshToken: null });
    const [l2] = await p.listLocations({ accountName: a2.accountName, refreshToken: null });
    expect(l1.name).not.toBe(l2.name);
  });

  it("lags metrics like Google does", async () => {
    const rows = await new MockGbpProvider(now).getDailyMetrics(team, "locations/9100000002", {
      start: "2026-11-01",
      end: "2026-11-17",
    });
    const latest = new Date(Date.UTC(2026, 10, 17) - METRICS_LAG_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(rows.at(-1)!.date).toBe(latest);
  });

  it("strong and weak sample profiles really differ", async () => {
    const p = new MockGbpProvider(now);
    const strong = await p.listReviews(team, "locations/9100000002");
    const weak = await p.listReviews(team, "locations/9100000001");
    expect(strong.length).toBeGreaterThan(weak.length * 4);
    const rate = (rs: typeof strong) => rs.filter((r) => r.reply).length / rs.length;
    expect(rate(strong)).toBeGreaterThan(rate(weak));
  });
});

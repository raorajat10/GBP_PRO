import { describe, expect, it } from "vitest";
import { change, parseRange, splitRange, totalsOf, type MetricDay } from "@/lib/owner/analytics";
import { attributeChangeLines } from "@/lib/owner/forms";
import { directionsLink, mapsLink, mobileForWhatsApp, reviewPageUrl } from "@/lib/owner/links";
import { activeHref, OWNER_NAV } from "@/lib/owner/nav";
import { isMonthKey, monthDays, reportMonths, shiftMonth } from "@/lib/owner/reports";
import { parseReviewFilters, reviewFilterQuery, summarizeReviews } from "@/lib/owner/reviews";

const day = (d: string, v = 1): MetricDay => ({
  day: d,
  impressions_search: 10 * v,
  impressions_maps: 5 * v,
  calls: v,
  direction_requests: v,
  website_clicks: 0,
});

describe("owner menu", () => {
  it("highlights the most specific matching link", () => {
    expect(activeHref("/home")).toBe("/home");
    expect(activeHref("/home/listing")).toBe("/home/listing");
    expect(activeHref("/home/listing/photos")).toBe("/home/listing/photos");
    expect(activeHref("/home/reviews/feedback")).toBe("/home/reviews/feedback");
    expect(activeHref("/home/insights/reports/2026-11")).toBe("/home/insights/reports");
    expect(activeHref("/home/unknown")).toBe("/home");
  });

  it("has every section the plan promised", () => {
    expect(OWNER_NAV.map((g) => g.label)).toEqual([
      "Listing",
      "Reviews",
      "Insights",
      "Grow",
      "Account",
    ]);
    expect(OWNER_NAV.flatMap((g) => g.links)).toHaveLength(16);
  });
});

describe("review filters", () => {
  it("parses only valid values and falls back to defaults", () => {
    expect(
      parseReviewFilters({ stars: "2", reply: "unreplied", sort: "lowest", page: "3" }),
    ).toEqual({
      stars: 2,
      reply: "unreplied",
      sort: "lowest",
      page: 3,
    });
    expect(parseReviewFilters({ stars: "9", reply: "x", sort: "y", page: "-1" })).toEqual({
      stars: null,
      reply: "all",
      sort: "newest",
      page: 1,
    });
  });

  it("builds short query strings without defaults", () => {
    expect(reviewFilterQuery({ stars: null, reply: "all", sort: "newest", page: 1 })).toBe("");
    expect(reviewFilterQuery({ stars: 5, reply: "replied", sort: "newest", page: 2 })).toBe(
      "?stars=5&reply=replied&page=2",
    );
  });

  it("summarises ratings and replies", () => {
    const s = summarizeReviews([
      { star_rating: 5, replied: true },
      { star_rating: 4, replied: false },
      { star_rating: 5, replied: true },
      { star_rating: 1, replied: false },
    ]);
    expect(s).toMatchObject({
      total: 4,
      average: 3.8,
      counts: [1, 0, 0, 1, 2],
      replied: 2,
      needsReply: 2,
    });
    expect(s.replyRate).toBe(0.5);
    expect(summarizeReviews([]).average).toBeNull();
  });
});

describe("analytics ranges", () => {
  const all = Array.from({ length: 20 }, (_, i) =>
    day(`2026-11-${String(i + 1).padStart(2, "0")}`, i < 10 ? 1 : 2),
  );

  it("takes the last N days and the N days before for comparison", () => {
    const { current, previous, dates } = splitRange(all, 7);
    expect(dates[0]).toBe("2026-11-14");
    expect(dates.at(-1)).toBe("2026-11-20");
    expect(current).toHaveLength(7);
    expect(previous?.[0].day).toBe("2026-11-07");
  });

  it("has no comparison when history is too short, and fills gaps with zero", () => {
    expect(splitRange(all, 30).previous).toBeNull();
    expect(splitRange(all, 30).dates).toHaveLength(20);
    const gappy = [day("2026-11-01"), day("2026-11-03")];
    expect(splitRange(gappy, 7).current.map((d) => d.calls)).toEqual([1, 0, 1]);
  });

  it("totals and engagement", () => {
    const t = totalsOf([day("2026-11-01", 2)]);
    expect(t).toMatchObject({ views: 30, actions: 4, search: 20, maps: 10 });
    expect(t.engagement).toBeCloseTo(4 / 30);
    expect(totalsOf([]).engagement).toBeNull();
  });

  it("percent change and range parsing", () => {
    expect(change(120, 100)).toBe(20);
    expect(change(50, 100)).toBe(-50);
    expect(change(5, 0)).toBeNull();
    expect(change(5, null)).toBeNull();
    expect(parseRange("7")).toBe(7);
    expect(parseRange("13")).toBe(30);
  });
});

describe("report months", () => {
  it("validates and shifts month keys", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("../x")).toBe(false);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthDays("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
  });

  it("lists months from now back to the first data, newest first", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    expect(reportMonths(now, "2026-09-15")).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(reportMonths(now, null)).toEqual([]);
    expect(reportMonths(now, "2020-01-01")).toHaveLength(12);
  });
});

describe("attribute change requests", () => {
  it("lists only what differs", () => {
    expect(
      attributeChangeLines(["accepts_upi", "free_wifi"], ["accepts_upi", "women_owned"], (k) => k),
    ).toEqual(["Turn on: women_owned", "Turn off: free_wifi"]);
    expect(attributeChangeLines(["a"], ["a"], (k) => k)).toEqual([]);
  });
});

describe("public links", () => {
  it("builds maps, directions and review links", () => {
    expect(mapsLink({ placeId: "ChIJ1", title: "X" })).toBe(
      "https://www.google.com/maps/place/?q=place_id:ChIJ1",
    );
    expect(mapsLink({ placeId: null, title: "Sarvatra Energy" })).toContain(
      "search/Sarvatra%20Energy",
    );
    expect(directionsLink({ placeId: "P", title: "A B" })).toContain("destination_place_id=P");
    expect(reviewPageUrl("https://x.in/", "sar va")).toBe("https://x.in/review/sar%20va");
  });

  it("offers WhatsApp only for Indian mobile numbers", () => {
    expect(mobileForWhatsApp("+91 98290 12345")).toBe("919829012345");
    expect(mobileForWhatsApp("9829012345")).toBe("919829012345");
    expect(mobileForWhatsApp("+91 141 2345678")).toBeNull();
    expect(mobileForWhatsApp(null)).toBeNull();
  });
});

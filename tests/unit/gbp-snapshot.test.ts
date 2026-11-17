import { describe, expect, it } from "vitest";
import { summarizeLocation } from "@/lib/gbp/snapshot";
import type { GbpLocation, GbpReview } from "@/lib/gbp/types";

const now = new Date("2026-11-17T12:00:00Z");
const daysAgo = (d: number, h = 0) =>
  new Date(now.getTime() - d * 86_400_000 - h * 3_600_000).toISOString();

const profile = { name: "locations/1", title: "Test" } as GbpLocation;

function review(days: number, stars: GbpReview["starRating"], replyAfterHours?: number): GbpReview {
  return {
    name: `r${days}`,
    reviewer: "A",
    starRating: stars,
    comment: null,
    createTime: daysAgo(days),
    reply:
      replyAfterHours === undefined
        ? null
        : { comment: "Thanks", updateTime: daysAgo(days, -replyAfterHours) },
  };
}

describe("summarizeLocation", () => {
  const s = summarizeLocation({
    profile,
    now,
    media: [
      { name: "m1", category: "LOGO", createTime: daysAgo(100) },
      { name: "m2", category: "EXTERIOR", createTime: daysAgo(5) },
    ],
    posts: [
      { name: "p1", summary: "", topicType: "STANDARD", state: "LIVE", createTime: daysAgo(2) },
      { name: "p2", summary: "", topicType: "STANDARD", state: "LIVE", createTime: daysAgo(20) },
      { name: "p3", summary: "", topicType: "STANDARD", state: "REJECTED", createTime: daysAgo(1) },
    ],
    reviews: [review(10, 5, 4), review(20, 4, 10), review(30, 2), review(200, 5, 2)],
    metrics: [
      {
        date: "2026-11-10",
        impressionsSearch: 10,
        impressionsMaps: 5,
        calls: 1,
        directionRequests: 2,
        websiteClicks: 0,
      },
      {
        date: "2026-11-11",
        impressionsSearch: 20,
        impressionsMaps: 5,
        calls: 2,
        directionRequests: 0,
        websiteClicks: 3,
      },
    ],
  });

  it("counts photos, logo and recency", () => {
    expect(s.photos).toMatchObject({ total: 2, last30Days: 1, hasLogo: true, hasCover: false });
  });

  it("ignores rejected posts", () => {
    expect(s.posts).toMatchObject({ total: 2, last7Days: 1, last30Days: 2 });
  });

  it("computes rating, unanswered and 90-day reply stats", () => {
    expect(s.reviews.total).toBe(4);
    expect(s.reviews.average).toBe(4); // (5+4+2+5)/4
    expect(s.reviews.unanswered).toBe(1);
    expect(s.reviews.last90Days).toBe(3);
    expect(s.reviews.repliedLast90Days).toBe(2);
    expect(s.reviews.replyRateLast90Days).toBeCloseTo(2 / 3);
    expect(s.reviews.medianReplyHoursLast90Days).toBe(7); // median of 4h and 10h
  });

  it("totals metrics and records the covered dates", () => {
    expect(s.metrics).toEqual({
      days: 2,
      from: "2026-11-10",
      to: "2026-11-11",
      impressions: 40,
      calls: 3,
      directionRequests: 2,
      websiteClicks: 3,
    });
  });

  it("handles a brand-new profile with nothing on it", () => {
    const empty = summarizeLocation({
      profile,
      now,
      media: [],
      posts: [],
      reviews: [],
      metrics: [],
    });
    expect(empty.reviews.average).toBeNull();
    expect(empty.reviews.replyRateLast90Days).toBeNull();
    expect(empty.photos.latest).toBeNull();
    expect(empty.metrics.days).toBe(0);
  });
});

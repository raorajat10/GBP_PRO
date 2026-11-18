import { describe, expect, it } from "vitest";
import { AUDIT_WEIGHTS, type AuditCheckKey } from "@/config/audit";
import { auditSnapshot, upcomingHolidays, type AuditItem } from "@/lib/audit/checks";
import { MockGbpProvider } from "@/lib/gbp/mock/provider";
import { ARCHETYPES, TEAM_ACCOUNT } from "@/lib/gbp/mock/data";
import { collectSnapshot, type LocationSnapshot } from "@/lib/gbp/snapshot";

const NOW = "2026-11-18T06:30:00.000Z";

/** A profile that passes every check. Tests break one thing at a time. */
function perfect(): LocationSnapshot {
  return {
    version: 1,
    syncedAt: NOW,
    profile: {
      name: "locations/1",
      accountName: "accounts/1",
      title: "Surya Rooftop Solar",
      placeId: "P1",
      verified: true,
      primaryCategory: { id: "gcid:solar_energy_company", displayName: "Solar energy company" },
      additionalCategories: [
        { id: "gcid:a", displayName: "Solar energy system service" },
        { id: "gcid:b", displayName: "Electrical installation service" },
      ],
      phone: "+91 141 000 0001",
      websiteUri: "https://example.com",
      address: {
        addressLines: ["Shop 1", "Malviya Nagar"],
        locality: "Jaipur",
        administrativeArea: "Rajasthan",
        postalCode: "302017",
        regionCode: "IN",
      },
      description:
        "We design and install rooftop solar systems for homes, schools and small businesses in Malviya Nagar and across Jaipur. Our team handles the site survey, installation, net-metering paperwork and after-sales service, and explains system size and expected generation clearly.",
      regularHours: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map(
        (day) => ({ day: day as "MONDAY", open: "10:00", close: "19:00" }),
      ),
      specialHours: [{ date: "2026-12-25", closed: true }],
      services: ["Rooftop solar installation", "Site survey", "Annual maintenance"],
      attributes: ["accepts_upi", "onsite_services", "wheelchair_accessible"],
      openingDate: null,
    },
    photos: { total: 20, last30Days: 2, hasLogo: true, hasCover: true, latest: NOW },
    posts: { total: 20, last7Days: 1, last30Days: 4, latest: NOW },
    reviews: {
      total: 60,
      average: 4.6,
      unanswered: 1,
      last90Days: 10,
      repliedLast90Days: 10,
      replyRateLast90Days: 1,
      medianReplyHoursLast90Days: 12,
      latest: NOW,
    },
    metrics: {
      days: 28,
      from: null,
      to: null,
      impressions: 0,
      calls: 0,
      directionRequests: 0,
      websiteClicks: 0,
    },
  };
}

type Patch = (s: LocationSnapshot) => void;
function scoreWith(patch: Patch) {
  const s = perfect();
  patch(s);
  return auditSnapshot(s);
}
const item = (r: { items: AuditItem[] }, key: AuditCheckKey) => r.items.find((i) => i.key === key)!;

describe("audit config", () => {
  it("weights add up to 100", () => {
    expect(Object.values(AUDIT_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("auditSnapshot", () => {
  it("gives a perfect profile 100 with every check passing and no fixes", () => {
    const r = auditSnapshot(perfect());
    expect(r.score).toBe(100);
    expect(r.items).toHaveLength(10);
    for (const i of r.items) {
      expect(i, i.key).toMatchObject({ status: "pass", pointsLost: 0, fix: "" });
    }
  });

  it("score is the sum of item points, and ranks by points lost", () => {
    const r = scoreWith((s) => {
      s.photos.total = 0;
      s.photos.last30Days = 0;
      s.profile.attributes = [];
    });
    expect(r.score).toBe(r.items.reduce((t, i) => t + i.points, 0));
    expect(r.items.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.items[0].key).toBe("photos");
    expect(r.items[1].key).toBe("attributes");
    for (let k = 1; k < r.items.length; k++) {
      expect(r.items[k - 1].pointsLost).toBeGreaterThanOrEqual(r.items[k].pointsLost);
    }
  });

  it("is deterministic and scores at the snapshot's own time by default", () => {
    expect(auditSnapshot(perfect())).toEqual(auditSnapshot(perfect()));
  });

  describe("description", () => {
    it("fails with no description", () => {
      const i = item(
        scoreWith((s) => (s.profile.description = null)),
        "description",
      );
      expect(i).toMatchObject({ status: "fail", points: 0 });
      expect(i.fix).toMatch(/250–750/);
    });
    it("loses length points when too short", () => {
      const i = item(
        scoreWith((s) => (s.profile.description = "Solar installation in Malviya Nagar.")),
        "description",
      );
      expect(i.points).toBe(7); // present 4 + services 1.5 + area 1.5
      expect(i.fix).toMatch(/at least 250/);
    });
    it("loses points when area and services are not mentioned", () => {
      const i = item(
        scoreWith((s) => (s.profile.description = "We are a trusted family business. ".repeat(10))),
        "description",
      );
      expect(i.points).toBe(7); // present 4 + length 3
      expect(i.fix).toMatch(/services/);
      expect(i.fix).toMatch(/Malviya Nagar/);
    });
  });

  describe("categories", () => {
    it("gives partial credit for one secondary category", () => {
      const i = item(
        scoreWith((s) => s.profile.additionalCategories.pop()),
        "categories",
      );
      expect(i).toMatchObject({ status: "warn", points: 8 });
    });
    it("fails with no primary and no secondary categories", () => {
      const i = item(
        scoreWith((s) => {
          s.profile.primaryCategory = null;
          s.profile.additionalCategories = [];
        }),
        "categories",
      );
      expect(i).toMatchObject({ status: "fail", points: 0 });
    });
  });

  describe("hours", () => {
    it("needs holiday hours in the coming weeks and names the festivals", () => {
      const i = item(
        scoreWith((s) => (s.profile.specialHours = [])),
        "hours",
      );
      expect(i).toMatchObject({ status: "warn", points: 5 });
      expect(i.fix).toMatch(/Christmas \(25 Dec\)/);
    });
    it("ignores special hours in the past", () => {
      const i = item(
        scoreWith((s) => (s.profile.specialHours = [{ date: "2026-11-08", closed: true }])),
        "hours",
      );
      expect(i.points).toBe(5);
    });
    it("fails with no hours at all", () => {
      const i = item(
        scoreWith((s) => {
          s.profile.regularHours = [];
          s.profile.specialHours = [];
        }),
        "hours",
      );
      expect(i).toMatchObject({ status: "fail", points: 0 });
    });
    it("lists only holidays inside the look-ahead window", () => {
      const names = upcomingHolidays(Date.parse(NOW)).map((h) => h.name);
      expect(names).toEqual(["Christmas", "New Year's Day"]);
    });
  });

  it("contact: half points for a missing website", () => {
    const i = item(
      scoreWith((s) => (s.profile.websiteUri = null)),
      "contact",
    );
    expect(i).toMatchObject({ status: "warn", points: 3 });
    expect(i.fix).toMatch(/website/);
  });

  describe("photos", () => {
    it("scales with the number of photos and checks logo, cover and recency", () => {
      const i = item(
        scoreWith((s) => (s.photos = { ...s.photos, total: 5, last30Days: 0, hasLogo: false })),
        "photos",
      );
      // 14 × (0.4×0.5 + 0 + 0 + 0.15) = 4.9 → 5
      expect(i).toMatchObject({ status: "fail", points: 5 });
      expect(i.fix).toMatch(/5 more photos/);
      expect(i.fix).toMatch(/logo/);
      expect(i.fix).toMatch(/every month/);
    });
  });

  describe("posts", () => {
    it("wants a post this week and four a month", () => {
      const i = item(
        scoreWith((s) => (s.posts = { ...s.posts, last7Days: 0, last30Days: 2 })),
        "posts",
      );
      expect(i).toMatchObject({ status: "fail", points: 3 });
    });
  });

  describe("reviews", () => {
    it("scales review count and rating", () => {
      const i = item(
        scoreWith((s) => (s.reviews = { ...s.reviews, total: 10, average: 3.85 })),
        "reviews",
      );
      // 14 × (0.5×0.4 + 0.5×0.5) = 6.3 → 6
      expect(i).toMatchObject({ status: "fail", points: 6 });
    });
    it("never suggests anything but asking every customer (no review gating)", () => {
      const i = item(
        scoreWith((s) => (s.reviews = { ...s.reviews, total: 3 })),
        "reviews",
      );
      expect(i.fix).toMatch(/same link for everyone/);
      expect(i.fix).not.toMatch(/happy|satisfied|5[- ]star/i);
    });
    it("gives zero rating points with no reviews", () => {
      const i = item(
        scoreWith((s) => (s.reviews = { ...s.reviews, total: 0, average: null })),
        "reviews",
      );
      expect(i.points).toBe(0);
    });
  });

  describe("replies", () => {
    it("passes when there is nothing to reply to", () => {
      const i = item(
        scoreWith(
          (s) =>
            (s.reviews = {
              ...s.reviews,
              last90Days: 0,
              repliedLast90Days: 0,
              replyRateLast90Days: null,
              medianReplyHoursLast90Days: null,
            }),
        ),
        "replies",
      );
      expect(i.status).toBe("pass");
    });
    it("counts reply rate and reply speed", () => {
      const i = item(
        scoreWith(
          (s) =>
            (s.reviews = {
              ...s.reviews,
              last90Days: 10,
              repliedLast90Days: 3,
              replyRateLast90Days: 0.3,
              medianReplyHoursLast90Days: 100,
            }),
        ),
        "replies",
      );
      // 12 × 0.7 × (0.3/0.9) = 2.8 → 3
      expect(i).toMatchObject({ status: "fail", points: 3 });
      expect(i.fix).toMatch(/7 reviews/);
      expect(i.fix).toMatch(/48 hours/);
    });
  });

  it("services: partial credit below three", () => {
    const i = item(
      scoreWith((s) => (s.profile.services = ["Site survey"])),
      "services",
    );
    expect(i).toMatchObject({ status: "fail", points: 3 });
  });

  it("attributes: partial credit below three", () => {
    const i = item(
      scoreWith((s) => (s.profile.attributes = ["accepts_upi", "x"])),
      "attributes",
    );
    expect(i).toMatchObject({ status: "warn", points: 4 });
  });
});

describe("sample profiles (M5 acceptance)", () => {
  const now = new Date(NOW);
  const provider = new MockGbpProvider(now);
  const creds = { accountName: TEAM_ACCOUNT.name, refreshToken: null };
  const scoreOf = async (title: string) => {
    const a = ARCHETYPES.find((x) => x.title === title)!;
    return auditSnapshot(await collectSnapshot(provider, creds, `locations/${a.id}`, now)).score;
  };

  it("a weak profile scores lower than a strong one", async () => {
    const strong = await scoreOf("Surya Rooftop Solar");
    const middling = await scoreOf("Jaipur Inverter Point");
    const weak = await scoreOf("Sharma Battery House");
    const weakest = await scoreOf("Gupta Kirana & General Store");
    expect(strong).toBeGreaterThanOrEqual(85);
    expect(weak).toBeLessThan(50);
    expect(strong).toBeGreaterThan(middling);
    expect(middling).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(weakest);
  });
});

import { describe, expect, it } from "vitest";
import {
  activeAttributes,
  originalComment,
  serviceTypeLabel,
  toDailyMetrics,
  toGbpLocalPost,
  toGbpLocation,
  toGbpMedia,
  toGbpReview,
  v4LocationPath,
} from "@/lib/gbp/google/mappers";

describe("toGbpLocation", () => {
  it("maps a full Business Information location", () => {
    const loc = toGbpLocation(
      {
        name: "locations/123",
        title: "Sarvatra Energy",
        phoneNumbers: { primaryPhone: "+91 98290 12345" },
        categories: {
          primaryCategory: {
            name: "categories/gcid:solar_energy_company",
            displayName: "Solar energy company",
          },
          additionalCategories: [
            { name: "categories/gcid:electrician", displayName: "Electrician" },
          ],
        },
        storefrontAddress: {
          addressLines: ["Shop 6, Tonk Road", "Sitapura"],
          locality: "Jaipur",
          administrativeArea: "Rajasthan",
          postalCode: "302022",
          regionCode: "IN",
        },
        websiteUri: "https://sarvatraenergy.com",
        regularHours: {
          periods: [
            {
              openDay: "MONDAY",
              openTime: { hours: 9, minutes: 30 },
              closeDay: "MONDAY",
              closeTime: { hours: 19 },
            },
            { openDay: "SUNDAY", openTime: {}, closeDay: "SUNDAY" },
          ],
        },
        specialHours: {
          specialHourPeriods: [{ startDate: { year: 2026, month: 11, day: 8 }, closed: true }],
        },
        serviceItems: [
          { freeFormServiceItem: { label: { displayName: "Rooftop solar" } } },
          { structuredServiceItem: { serviceTypeId: "job_type_id:solar_panel_installation" } },
          { freeFormServiceItem: { label: { displayName: "Rooftop solar" } } },
        ],
        profile: { description: "Solar for homes" },
        openInfo: { openingDate: { year: 2019, month: 4, day: 1 } },
        metadata: { placeId: "ChIJabc", hasVoiceOfMerchant: true },
      },
      "accounts/9",
      [{ name: "attributes/has_wheelchair_accessible_entrance", values: [true] }],
    );
    expect(loc).toMatchObject({
      name: "locations/123",
      accountName: "accounts/9",
      title: "Sarvatra Energy",
      placeId: "ChIJabc",
      verified: true,
      primaryCategory: { displayName: "Solar energy company" },
      phone: "+91 98290 12345",
      description: "Solar for homes",
      openingDate: "2019-04-01",
      specialHours: [{ date: "2026-11-08", closed: true }],
      services: ["Rooftop solar", "Solar panel installation"],
      attributes: ["wheelchair_accessible"],
    });
    expect(loc.address?.locality).toBe("Jaipur");
    expect(loc.regularHours).toEqual([
      { day: "MONDAY", open: "09:30", close: "19:00" },
      { day: "SUNDAY", open: "00:00", close: "24:00" }, // open 24 hours
    ]);
  });

  it("copes with a bare location", () => {
    const loc = toGbpLocation({ name: "locations/1" }, "accounts/2");
    expect(loc).toMatchObject({
      title: "Unnamed business",
      placeId: null,
      address: null,
      services: [],
      attributes: [],
    });
  });
});

describe("attributes", () => {
  it("keeps only switched-on ones, as our keys", () => {
    expect(
      activeAttributes([
        { name: "attributes/pay_mobile_nfc", values: [true] },
        { name: "attributes/pay_credit_card", values: [true] },
        { name: "attributes/pay_debit_card", values: [true] },
        { name: "attributes/has_restroom", values: [false] },
        { name: "locations/1/attributes/wi_fi", values: ["free_wi_fi"] },
        { name: "attributes/some_new_thing", values: [true] },
      ]),
    ).toEqual(["accepts_nfc", "accepts_cards", "free_wifi", "some_new_thing"]);
  });

  it("labels structured services", () => {
    expect(serviceTypeLabel("job_type_id:solar_panel_installation")).toBe(
      "Solar panel installation",
    );
  });
});

describe("reviews, media, posts", () => {
  it("maps stars, anonymous reviewers and replies", () => {
    expect(
      toGbpReview({
        name: "accounts/1/locations/2/reviews/r1",
        reviewer: { displayName: "Asha" },
        starRating: "FOUR",
        comment: "Great work",
        createTime: "2026-11-01T10:00:00Z",
        reviewReply: { comment: "Thank you!", updateTime: "2026-11-02T10:00:00Z" },
      }),
    ).toEqual({
      name: "accounts/1/locations/2/reviews/r1",
      reviewer: "Asha",
      starRating: 4,
      comment: "Great work",
      createTime: "2026-11-01T10:00:00Z",
      reply: { comment: "Thank you!", updateTime: "2026-11-02T10:00:00Z" },
    });
    expect(
      toGbpReview({
        name: "r",
        reviewer: { isAnonymous: true },
        starRating: "ONE",
        createTime: "2026-01-01T00:00:00Z",
      })?.reviewer,
    ).toBe("A Google user");
    expect(
      toGbpReview({ name: "r", starRating: "STAR_RATING_UNSPECIFIED", createTime: "x" }),
    ).toBeNull();
  });

  it("keeps the original language of translated reviews", () => {
    expect(originalComment("(Translated by Google) Very good\n\n(Original)\nबहुत अच्छा")).toBe(
      "बहुत अच्छा",
    );
    expect(originalComment("   ")).toBeNull();
  });

  it("maps media categories and post states", () => {
    expect(
      toGbpMedia({
        name: "m",
        locationAssociation: { category: "AT_WORK" },
        createTime: "2026-01-01T00:00:00Z",
      })?.category,
    ).toBe("AT_WORK");
    expect(
      toGbpMedia({
        name: "m",
        locationAssociation: { category: "WEIRD" },
        createTime: "2026-01-01T00:00:00Z",
      })?.category,
    ).toBe("ADDITIONAL");
    expect(
      toGbpLocalPost({
        name: "p",
        summary: "Hi",
        topicType: "OFFER",
        state: "LIVE",
        createTime: "2026-01-01T00:00:00Z",
      }),
    ).toMatchObject({ topicType: "OFFER", state: "LIVE" });
  });
});

describe("daily metrics", () => {
  it("adds desktop + mobile, one row per day, sorted", () => {
    const rows = toDailyMetrics({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 11, day: 2 }, value: "3" },
                  { date: { year: 2026, month: 11, day: 1 }, value: "1" },
                ],
              },
            },
            {
              dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
              timeSeries: {
                datedValues: [{ date: { year: 2026, month: 11, day: 1 }, value: "4" }],
              },
            },
            {
              dailyMetric: "CALL_CLICKS",
              timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 1 } }] },
            },
          ],
        },
      ],
    });
    expect(rows).toEqual([
      {
        date: "2026-11-01",
        impressionsSearch: 5,
        impressionsMaps: 0,
        calls: 0,
        directionRequests: 0,
        websiteClicks: 0,
      },
      {
        date: "2026-11-02",
        impressionsSearch: 3,
        impressionsMaps: 0,
        calls: 0,
        directionRequests: 0,
        websiteClicks: 0,
      },
    ]);
  });

  it("builds v4 paths only from well-formed names", () => {
    expect(v4LocationPath("accounts/1", "locations/2")).toBe("accounts/1/locations/2");
    expect(() => v4LocationPath("accounts/1", "locations/2/../x")).toThrow();
    expect(() => v4LocationPath("../evil", "locations/2")).toThrow();
  });
});

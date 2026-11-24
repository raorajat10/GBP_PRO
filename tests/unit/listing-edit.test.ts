import { describe, expect, it } from "vitest";
import {
  applyEdit,
  changedOnly,
  describeEdit,
  normalisePhone,
  normaliseWebsite,
  parseListingForm,
  toGooglePatch,
} from "@/lib/gbp/listing-edit";
import type { GbpLocation } from "@/lib/gbp/types";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const profile = {
  name: "locations/1",
  phone: "+91 98290 12345",
  websiteUri: "https://sarvatraenergy.com",
  description: "Solar for homes",
  regularHours: [{ day: "MONDAY", open: "09:30", close: "19:00" }],
} as unknown as GbpLocation;

describe("phone and website", () => {
  it("accepts common Indian phone formats", () => {
    expect(normalisePhone("98290 12345")).toBe("+91 98290 12345");
    expect(normalisePhone("+91-98290-12345")).toBe("+91 98290 12345");
    expect(normalisePhone("0141 2345678")).toBe("+91 1412345678");
    expect(normalisePhone("12345")).toBeNull();
  });

  it("adds https and refuses non-addresses", () => {
    expect(normaliseWebsite("sarvatraenergy.com")).toBe("https://sarvatraenergy.com");
    expect(normaliseWebsite("https://x.in/solar/")).toBe("https://x.in/solar");
    expect(normaliseWebsite("not a site")).toBeNull();
  });
});

describe("parseListingForm", () => {
  it("reads every field and the week's hours", () => {
    const r = parseListingForm(
      form({
        phone: "9829012345",
        website: "sarvatraenergy.com",
        description: "Rooftop solar in Jaipur",
        hours: "1",
        "hours.MONDAY.mode": "hours",
        "hours.MONDAY.open": "09:00",
        "hours.MONDAY.close": "18:30",
        "hours.SATURDAY.mode": "24h",
        "hours.SUNDAY.mode": "closed",
      }),
    );
    expect(r).toEqual({
      ok: true,
      edit: {
        phone: "+91 98290 12345",
        website: "https://sarvatraenergy.com",
        description: "Rooftop solar in Jaipur",
        hours: [
          { day: "MONDAY", open: "09:00", close: "18:30" },
          { day: "SATURDAY", open: "00:00", close: "24:00" },
        ],
      },
    });
  });

  it("explains what is wrong", () => {
    const r = parseListingForm(
      form({
        phone: "123",
        website: "nope",
        description: "Visit https://spam.example",
        hours: "1",
        "hours.MONDAY.mode": "hours",
        "hours.MONDAY.open": "18:00",
        "hours.MONDAY.close": "09:00",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        "description",
        "hours.MONDAY",
        "phone",
        "website",
      ]);
      expect(r.errors["hours.MONDAY"]).toMatch(/closing time must be after/);
    }
  });

  it("keeps split hours it doesn't edit, and refuses tampered ones", () => {
    const split = JSON.stringify([
      { day: "TUESDAY", open: "09:00", close: "13:00" },
      { day: "TUESDAY", open: "14:00", close: "19:00" },
    ]);
    const ok = parseListingForm(
      form({ hours: "1", "hours.TUESDAY.mode": "keep", "hours.TUESDAY.slots": split }),
    );
    expect(ok.ok && ok.edit.hours).toHaveLength(2);
    const bad = parseListingForm(
      form({
        hours: "1",
        "hours.TUESDAY.mode": "keep",
        "hours.TUESDAY.slots": '[{"day":"FRIDAY","open":"x"}]',
      }),
    );
    expect(bad.ok).toBe(false);
  });
});

describe("sending the edit", () => {
  it("sends only real changes", () => {
    expect(
      changedOnly(
        { phone: "+91 98290 12345", website: "https://new.in", hours: profile.regularHours },
        profile,
      ),
    ).toEqual({ website: "https://new.in" });
  });

  it("treats the same phone or website written differently as unchanged", () => {
    const stored = {
      ...profile,
      phone: "0141 2345678",
      websiteUri: "https://x.in/",
    } as GbpLocation;
    expect(changedOnly({ phone: "+91 1412345678", website: "https://x.in" }, stored)).toEqual({});
  });

  it("builds Google's update mask and body, including open-24-hours days", () => {
    expect(
      toGooglePatch({
        phone: "+91 98290 12345",
        description: null,
        hours: [
          { day: "MONDAY", open: "09:30", close: "19:00" },
          { day: "SUNDAY", open: "00:00", close: "24:00" },
        ],
      }),
    ).toEqual({
      updateMask: "phoneNumbers.primaryPhone,profile.description,regularHours",
      body: {
        phoneNumbers: { primaryPhone: "+91 98290 12345" },
        profile: { description: "" },
        regularHours: {
          periods: [
            {
              openDay: "MONDAY",
              openTime: { hours: 9, minutes: 30 },
              closeDay: "MONDAY",
              closeTime: { hours: 19 },
            },
            { openDay: "SUNDAY", openTime: {}, closeDay: "SUNDAY", closeTime: { hours: 24 } },
          ],
        },
      },
    });
  });

  it("updates our stored copy and describes the change", () => {
    const next = applyEdit(profile, { description: "New text" });
    expect(next.description).toBe("New text");
    expect(next.phone).toBe(profile.phone);
    expect(describeEdit({ phone: null, hours: [] })).toBe("phone, opening hours");
  });
});

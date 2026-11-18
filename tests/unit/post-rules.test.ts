import { describe, expect, it } from "vitest";
import {
  charCount,
  devanagariShare,
  earliestScheduleIstLocal,
  hasLink,
  hasPhoneNumber,
  matchesLanguageScript,
  parseIstLocal,
  postIssues,
  POST_MAX_CHARS,
  scheduleProblem,
  toIstLocal,
} from "@/lib/posts/rules";

describe("phone numbers in post text", () => {
  it.each([
    "Call 9829012345 today",
    "Call +91 98290 12345",
    "Ph: 098290-12345",
    "Landline 0141 222 3344",
    "(0141) 2223344",
    "Call 98290.12345",
    "कॉल करें ९८२९० १२३४५",
  ])("flags %s", (text) => expect(hasPhoneNumber(text)).toBe(true));

  it.each([
    "2-year warranty on Exide batteries",
    "Prices from ₹4,999 this week",
    "Open 10:00 to 19:30, 7 days",
    "150Ah tubular battery, 12V",
  ])("doesn't flag %s", (text) => expect(hasPhoneNumber(text)).toBe(false));
});

describe("links in post text", () => {
  it.each(["See https://example.com", "www.shop.in", "Visit sharmabattery.com"])("flags %s", (t) =>
    expect(hasLink(t)).toBe(true),
  );
  it("doesn't flag ordinary sentences", () => {
    expect(hasLink("Visit our shop in Vaishali Nagar. Open daily.")).toBe(false);
  });
});

describe("postIssues", () => {
  it("accepts a clean post", () => {
    expect(postIssues("New inverter batteries in stock. Visit us today!")).toEqual([]);
  });
  it("lists every problem", () => {
    const text = `${"a".repeat(POST_MAX_CHARS)} call 9829012345 www.x.com`;
    expect(postIssues(text)).toEqual(["too_long", "phone", "link"]);
    expect(postIssues("   ")).toEqual(["empty"]);
  });
  it("counts characters, not bytes (Hindi is multi-byte)", () => {
    expect(charCount("नमस्ते")).toBe(6);
    expect(postIssues("न".repeat(POST_MAX_CHARS))).toEqual([]);
    expect(postIssues("न".repeat(POST_MAX_CHARS + 1))).toEqual(["too_long"]);
  });
});

describe("language script check", () => {
  const hindi = "इन्वर्टर बैटरी पर दो साल की वारंटी। आज ही हमारी दुकान पर आइए।";
  const hinglish = "Ghar ke liye best inverter battery, 2 saal ki warranty ke saath. Aaj hi aaiye!";
  it("Hindi must be mostly Devanagari", () => {
    expect(devanagariShare(hindi)).toBeGreaterThan(0.9);
    expect(matchesLanguageScript(hindi, "hi")).toBe(true);
    expect(matchesLanguageScript(hinglish, "hi")).toBe(false);
  });
  it("English and Hinglish must be in Roman letters", () => {
    expect(matchesLanguageScript(hinglish, "hinglish")).toBe(true);
    expect(matchesLanguageScript(hinglish, "en")).toBe(true);
    expect(matchesLanguageScript(hindi, "hinglish")).toBe(false);
  });
  it("allows a brand name in another script", () => {
    expect(matchesLanguageScript("Exide इन्वर्टर बैटरी अब हमारी दुकान पर उपलब्ध है।", "hi")).toBe(true);
  });
});

describe("schedule (India time)", () => {
  it("reads datetime-local values as IST", () => {
    expect(parseIstLocal("2026-11-20T10:30")?.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(toIstLocal(new Date("2026-11-20T05:00:00Z"))).toBe("2026-11-20T10:30");
  });
  it("rejects malformed values", () => {
    expect(parseIstLocal("20/11/2026 10:30")).toBeNull();
    expect(parseIstLocal("2026-13-45T10:30")).toBeNull();
  });
  it("needs at least 30 minutes and at most 90 days ahead", () => {
    const now = new Date("2026-11-18T06:00:00Z");
    expect(scheduleProblem(new Date("2026-11-18T06:10:00Z"), now)).toMatch(/30 minutes/);
    expect(scheduleProblem(new Date("2026-11-18T07:00:00Z"), now)).toBeNull();
    expect(scheduleProblem(new Date("2027-03-01T07:00:00Z"), now)).toMatch(/90 days/);
    expect(earliestScheduleIstLocal(now)).toBe("2026-11-18T12:00");
  });
});

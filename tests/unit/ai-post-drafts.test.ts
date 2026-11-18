import { describe, expect, it } from "vitest";
import { POST_SYSTEM, postUserMessage } from "@/lib/ai/prompts/post";
import { SampleWriter } from "@/lib/ai/sample";
import { AiError, sanitizePostDrafts, type PostDraftRequest } from "@/lib/ai/writer";
import { hasLink, hasPhoneNumber, matchesLanguageScript, POST_MAX_CHARS } from "@/lib/posts/rules";

const request: PostDraftRequest = {
  business: {
    title: "Sharma Battery House",
    category: "Battery store",
    area: "Vaishali Nagar",
    city: "Jaipur",
    industry: "battery",
    services: ["Inverter installation"],
    brandNotes: "Authorised Exide dealer. Friendly tone.",
  },
  note: "Exide inverter battery offer, 2-year warranty",
  language: "en",
  topicType: "OFFER",
  photo: null,
};

describe("sanitizePostDrafts", () => {
  it("keeps good drafts, drops rule-breakers and duplicates, and stops at three", () => {
    const good = (n: number) => ({
      angle: `A${n}`,
      body: `Good post number ${n}. Visit us today.`,
    });
    const r = sanitizePostDrafts(
      request,
      {
        drafts: [
          good(1),
          { angle: "Phone", body: "Call 98290 12345 now!" },
          { angle: "Link", body: "See www.sharmabattery.in" },
          { angle: "Long", body: "x".repeat(POST_MAX_CHARS + 1) },
          { angle: "Hindi", body: "आज ही हमारी दुकान पर आइए।" }, // wrong script for English
          good(1), // duplicate
          good(2),
          good(3),
          good(4),
        ],
      },
      "claude-sonnet-5-5",
    );
    expect(r.drafts.map((d) => d.angle)).toEqual(["A1", "A2", "A3"]);
    expect(r.model).toBe("claude-sonnet-5-5");
  });

  it("refuses to return nothing", () => {
    expect(() =>
      sanitizePostDrafts(request, { drafts: [{ angle: "x", body: "Call 9829012345" }] }, "m"),
    ).toThrow(AiError);
  });
});

describe("SampleWriter (used when no AI key is set)", () => {
  it.each(["en", "hi", "hinglish"] as const)(
    "gives 3 drafts in %s, under the limit, with no phone numbers or links",
    async (language) => {
      const r = await new SampleWriter().writePostDrafts({ ...request, language });
      expect(r.model).toBe("sample");
      expect(r.drafts).toHaveLength(3);
      for (const d of r.drafts) {
        expect([...d.body].length).toBeLessThanOrEqual(POST_MAX_CHARS);
        expect(hasPhoneNumber(d.body)).toBe(false);
        expect(hasLink(d.body)).toBe(false);
        expect(d.body).toContain("Exide inverter battery offer");
      }
    },
  );

  it("writes the Hindi template in Devanagari when the note is Hindi too", async () => {
    const r = await new SampleWriter().writePostDrafts({
      ...request,
      language: "hi",
      note: "एक्साइड इन्वर्टर बैटरी पर दो साल की वारंटी",
    });
    for (const d of r.drafts) expect(matchesLanguageScript(d.body, "hi")).toBe(true);
  });

  it("won't word audit fixes", async () => {
    await expect(new SampleWriter().writeAuditFixes()).rejects.toThrow(AiError);
  });
});

describe("post prompt", () => {
  it("sets the guardrails from the plan", () => {
    expect(POST_SYSTEM).toMatch(/No phone numbers/);
    expect(POST_SYSTEM).toMatch(/Never invent prices, discounts, offers/);
    expect(POST_SYSTEM).toMatch(/no medical claims/);
    expect(POST_SYSTEM).toMatch(/1,500|1500/);
    expect(POST_SYSTEM).toMatch(/exactly 3 different drafts/);
  });

  it("treats the note as data and asks for the right language", () => {
    const msg = postUserMessage({ ...request, language: "hinglish" });
    expect(msg).toContain("<note>\nExide inverter battery offer, 2-year warranty\n</note>");
    expect(msg).toContain("Authorised Exide dealer");
    expect(msg).toMatch(/Hinglish/);
    expect(msg).toMatch(/an offer/);
    expect(msg).toMatch(/There is no photo/);
    expect(postUserMessage({ ...request, language: "hi" })).toMatch(/Devanagari/);
  });

  it("keeps the system prompt free of per-request data so it can be cached", () => {
    expect(POST_SYSTEM).not.toContain("Sharma");
  });
});

import { describe, expect, it } from "vitest";
import { AUDIT_FIX_SYSTEM, auditFixUserMessage } from "@/lib/ai/prompts/audit-fix";
import { sanitizeAuditFixes, type AuditFixRequest } from "@/lib/ai/writer";

const request: AuditFixRequest = {
  business: {
    title: "Sharma Battery House",
    primaryCategory: "Battery store",
    additionalCategories: [],
    area: "Vaishali Nagar",
    city: "Jaipur",
    services: [],
    attributes: [],
    description: null,
    industryNote: "Exide dealer",
  },
  items: [
    {
      key: "description",
      title: "Business description",
      status: "fail",
      pointsLost: 10,
      facts: "No business description.",
      ruleFix: "Add a description.",
    },
    {
      key: "photos",
      title: "Photos",
      status: "fail",
      pointsLost: 9,
      facts: "3 photos.",
      ruleFix: "Add photos.",
    },
  ],
};

const goodDescription =
  "Sharma Battery House in Vaishali Nagar, Jaipur sells and installs inverter batteries, car batteries and bike batteries. Our team helps you choose the right battery for your home or vehicle, fits it for you, and takes care of warranty claims. Visit our shop in Vaishali Nagar for honest advice.";

describe("sanitizeAuditFixes", () => {
  it("keeps clean fixes for the checks we asked about", () => {
    const r = sanitizeAuditFixes(
      request,
      {
        fixes: [
          { key: "photos", text: "  Add photos of the  battery shelves and the shop front. " },
          { key: "description", text: "Paste the suggested description below." },
        ],
        suggestedDescription: goodDescription,
      },
      "claude-opus-5-5",
    );
    expect(r.fixes).toEqual([
      { key: "photos", text: "Add photos of the battery shelves and the shop front." },
      { key: "description", text: "Paste the suggested description below." },
    ]);
    expect(r.suggestedDescription).toBe(goodDescription);
    expect(r.model).toBe("claude-opus-5-5");
  });

  it("drops unknown checks, duplicates, phone numbers and links", () => {
    const r = sanitizeAuditFixes(
      request,
      {
        fixes: [
          { key: "reviews", text: "Ask for reviews." }, // not asked
          { key: "photos", text: "Call 98290 12345 to book a photographer." },
          { key: "photos", text: "See https://example.com for ideas." },
          { key: "photos", text: "Add five photos." },
          { key: "photos", text: "A second photos fix." },
        ],
        suggestedDescription: null,
      },
      "m",
    );
    expect(r.fixes).toEqual([{ key: "photos", text: "Add five photos." }]);
  });

  it("rejects a suggested description that is too short, too long or has a phone number", () => {
    const run = (d: string) =>
      sanitizeAuditFixes(request, { fixes: [], suggestedDescription: d }, "m").suggestedDescription;
    expect(run("Battery shop in Jaipur.")).toBeNull();
    expect(run(goodDescription.repeat(3))).toBeNull();
    expect(run(`${goodDescription} Call +91 98290 12345.`)).toBeNull();
    expect(run(goodDescription)).toBe(goodDescription);
  });

  it("ignores a suggested description when the description check wasn't asked about", () => {
    const r = sanitizeAuditFixes(
      { ...request, items: request.items.filter((i) => i.key !== "description") },
      { fixes: [], suggestedDescription: goodDescription },
      "m",
    );
    expect(r.suggestedDescription).toBeNull();
  });
});

describe("audit fix prompt", () => {
  it("forbids invented offers, phone numbers and review gating", () => {
    expect(AUDIT_FIX_SYSTEM).toMatch(/Never invent prices, offers/);
    expect(AUDIT_FIX_SYSTEM).toMatch(/Never include phone numbers/);
    expect(AUDIT_FIX_SYSTEM).toMatch(
      /Never suggest offering incentives, asking only happy customers/,
    );
  });

  it("includes the business facts and every check", () => {
    const msg = auditFixUserMessage(request);
    expect(msg).toContain("Name: Sharma Battery House");
    expect(msg).toContain("Area: Vaishali Nagar, Jaipur");
    expect(msg).toContain("Notes from the agency: Exide dealer");
    expect(msg).toContain("key: description");
    expect(msg).toContain("key: photos");
  });

  it("keeps the system prompt free of per-request data so it can be cached", () => {
    expect(AUDIT_FIX_SYSTEM).not.toContain("Sharma");
  });
});

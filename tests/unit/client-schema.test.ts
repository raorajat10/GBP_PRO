import { describe, expect, it } from "vitest";
import {
  normalizeWhatsAppNumber,
  parseClientForm,
  replyLinkSchema,
  slugify,
  slugSchema,
  toClientRow,
} from "@/lib/clients/schema";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const MANAGER_ID = "0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b";

describe("normalizeWhatsAppNumber", () => {
  it.each([
    ["9829012345", "+919829012345"],
    ["98290 12345", "+919829012345"],
    ["098290-12345", "+919829012345"],
    ["91 98290 12345", "+919829012345"],
    ["+91 98290 12345", "+919829012345"],
    ["0091 9829012345", "+919829012345"],
    ["+971 50 123 4567", "+971501234567"], // non-Indian numbers kept as entered
  ])("%s → %s", (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it.each(["12345", "5829012345", "abcdefghij", "+0123456789", ""])("rejects %j", (input) => {
    expect(normalizeWhatsAppNumber(input)).toBeNull();
  });
});

describe("parseClientForm", () => {
  it("accepts a minimal client and fills sensible defaults", () => {
    const r = parseClientForm(form({ businessName: "  Shree Batteries  " }));
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      businessName: "Shree Batteries",
      ownerName: null,
      ownerWhatsapp: null,
      whatsappOptIn: false,
      preferredLanguage: "en",
      industry: null,
      assignedManagerId: null,
      status: "active",
    });
  });

  it("accepts a full client", () => {
    const r = parseClientForm(
      form({
        businessName: "Surya Solar",
        ownerName: "Ramesh",
        ownerWhatsapp: "98290 12345",
        whatsappOptIn: "on",
        preferredLanguage: "hinglish",
        industry: "solar",
        brandNotes: "Mention subsidy help",
        assignedManagerId: MANAGER_ID,
        status: "paused",
      }),
    );
    expect(r.success).toBe(true);
    expect(r.data?.ownerWhatsapp).toBe("+919829012345");
    expect(r.data?.whatsappOptIn).toBe(true);
  });

  it("requires a business name", () => {
    const r = parseClientForm(form({ businessName: "   " }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["businessName"]);
  });

  it("rejects a bad phone number with a helpful message", () => {
    const r = parseClientForm(form({ businessName: "X", ownerWhatsapp: "12345" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/valid mobile number/);
  });

  it("won't record WhatsApp consent without a number", () => {
    const r = parseClientForm(form({ businessName: "X", whatsappOptIn: "on" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["whatsappOptIn"]);
  });

  it("rejects values outside the allowed lists", () => {
    const bads: Record<string, string>[] = [
      { preferredLanguage: "fr" },
      { industry: "casino" },
      { status: "deleted" },
      { assignedManagerId: "not-a-uuid" },
    ];
    for (const bad of bads) {
      expect(
        parseClientForm(form({ businessName: "X", ...bad })).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe("toClientRow (WhatsApp consent timestamp)", () => {
  const base = parseClientForm(
    form({ businessName: "X", ownerWhatsapp: "9829012345", whatsappOptIn: "on" }),
  ).data!;
  const now = new Date("2026-11-17T10:00:00Z");

  it("records consent time when first ticked", () => {
    expect(toClientRow(base, null, now).whatsapp_opt_in_at).toBe(now.toISOString());
  });

  it("keeps the original consent time on later edits", () => {
    expect(toClientRow(base, "2026-01-01T00:00:00Z", now).whatsapp_opt_in_at).toBe(
      "2026-01-01T00:00:00Z",
    );
  });

  it("clears consent when unticked", () => {
    expect(
      toClientRow({ ...base, whatsappOptIn: false }, "2026-01-01T00:00:00Z", now)
        .whatsapp_opt_in_at,
    ).toBeNull();
  });
});

describe("reply studio link (slug)", () => {
  it.each([
    ["Sarvatra Energy", "sarvatra-energy"],
    ["  Raj's Battery & Inverter!! ", "raj-s-battery-inverter"],
    ["SARVTRA", "sarvtra"],
  ])("slugify(%j) → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("blank means 'generate it' (null), typed values are normalised", () => {
    expect(slugSchema.parse("")).toBeNull();
    expect(slugSchema.parse(" Sarvtra ")).toBe("sarvtra");
  });

  it.each(["!", "a", "शर्मा"])("rejects %j", (input) => {
    expect(slugSchema.safeParse(input).success).toBe(false);
  });

  it("only sends a slug to the database when one was given", () => {
    const blank = parseClientForm(form({ businessName: "Shop", slug: "" }));
    const set = parseClientForm(form({ businessName: "Shop", slug: "my-shop" }));
    expect(blank.success && "slug" in toClientRow(blank.data, null)).toBe(false);
    expect(set.success && toClientRow(set.data, null).slug).toBe("my-shop");
  });
});

describe("reply posting link", () => {
  it.each([
    "https://business.google.com/reviews",
    "https://www.google.com/maps/place/Sarvatra+Energy/@26.9,75.8,17z",
    "https://maps.app.goo.gl/AbC123xyz",
    "https://g.page/r/CabcDEF/review",
  ])("accepts %s", (link) => {
    expect(replyLinkSchema.parse(` ${link} `)).toBe(link);
  });

  it("blank clears it", () => {
    expect(replyLinkSchema.parse("")).toBeNull();
  });

  it.each([
    "http://business.google.com/reviews",
    "https://evil.com/?google.com",
    "https://google.com.evil.com/",
    "https://notgoogle.com/",
    "javascript:alert(1)",
  ])("rejects %s", (link) => {
    expect(replyLinkSchema.safeParse(link).success).toBe(false);
  });

  it("is saved with the client", () => {
    const parsed = parseClientForm(
      form({ businessName: "Shop", replyLink: "https://maps.app.goo.gl/AbC123xyz" }),
    );
    expect(parsed.success && toClientRow(parsed.data, null).reply_link).toBe(
      "https://maps.app.goo.gl/AbC123xyz",
    );
  });
});

import { describe, expect, it } from "vitest";
import { normalizeWhatsAppNumber, parseClientForm, toClientRow } from "@/lib/clients/schema";

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

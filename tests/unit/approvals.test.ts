import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { previewOf, formatIst } from "@/lib/approvals/format";
import { hashApprovalToken, looksLikeApprovalToken, newApprovalToken } from "@/lib/approvals/token";
import {
  MetaCloudWhatsApp,
  parseMetaWebhook,
  verifyMetaSignature,
} from "@/lib/messaging/meta-cloud";
import { parseButtonPayload, toE164, toWaNumber } from "@/lib/messaging/types";

describe("approval tokens", () => {
  it("are long, random, URL-safe and stored only as a hash", () => {
    const a = newApprovalToken();
    const b = newApprovalToken();
    expect(a).not.toBe(b);
    expect(looksLikeApprovalToken(a)).toBe(true);
    expect(hashApprovalToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApprovalToken(a)).toBe(hashApprovalToken(a));
    expect(hashApprovalToken(a)).not.toContain(a);
  });
  it("rejects anything that isn't shaped like a token before any lookup", () => {
    expect(looksLikeApprovalToken("short")).toBe(false);
    expect(looksLikeApprovalToken(`${"a".repeat(42)}/`)).toBe(false);
    expect(looksLikeApprovalToken("' or 1=1 --")).toBe(false);
  });
});

describe("previewOf", () => {
  it("leaves short text alone and flattens line breaks", () => {
    expect(previewOf("Hello\n\nworld")).toBe("Hello world");
  });
  it("cuts long text at a word boundary with an ellipsis", () => {
    const p = previewOf("word ".repeat(200), 100);
    expect([...p].length).toBeLessThanOrEqual(101);
    expect(p.endsWith("word…")).toBe(true);
  });
  it("counts Hindi characters correctly", () => {
    expect([...previewOf("न".repeat(700))].length).toBe(601);
  });
});

it("formats times in India time", () => {
  expect(formatIst(new Date("2026-11-20T05:00:00Z"))).toMatch(/20 Nov.*10:30/i);
});

describe("WhatsApp button payloads and numbers", () => {
  const id = "0b0e7c9e-1a2b-4c3d-8e9f-001122334455";
  it("parse only our own payloads", () => {
    expect(parseButtonPayload(`approve:${id}`)).toEqual({ decision: "approved", approvalId: id });
    expect(parseButtonPayload(`change:${id}`)).toEqual({
      decision: "changes_requested",
      approvalId: id,
    });
    expect(parseButtonPayload("approve:not-an-id")).toBeNull();
    expect(parseButtonPayload("Approve")).toBeNull();
  });
  it("convert between WhatsApp and E.164 numbers", () => {
    expect(toE164("919829012345")).toBe("+919829012345");
    expect(toWaNumber("+919829012345")).toBe("919829012345");
  });
});

describe("Meta webhook signature", () => {
  const secret = "test-app-secret";
  const body = JSON.stringify({ hello: "world" });
  const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  it("accepts Meta's signature", () => {
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });
  it("rejects a wrong secret, a changed body, or a missing header", () => {
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    expect(verifyMetaSignature(`${body} `, sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=zz", secret)).toBe(false);
  });
});

describe("parseMetaWebhook", () => {
  const ours = "1111";
  const hook = (phoneNumberId: string, value: Record<string, unknown>) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          { field: "messages", value: { metadata: { phone_number_id: phoneNumberId }, ...value } },
        ],
      },
    ],
  });

  it("reads template button taps, texts and delivery statuses", () => {
    const events = parseMetaWebhook(
      hook(ours, {
        messages: [
          {
            from: "919829012345",
            id: "wamid.1",
            type: "button",
            button: { payload: "approve:x", text: "Approve" },
          },
          {
            from: "919829012345",
            id: "wamid.2",
            type: "text",
            text: { body: "Use the Diwali photo" },
          },
          { from: "919829012345", id: "wamid.3", type: "image" },
        ],
        statuses: [
          { id: "wamid.out", status: "delivered" },
          { id: "wamid.bad", status: "failed", errors: [{ message: "Re-engagement needed" }] },
        ],
      }),
      ours,
    );
    expect(events).toEqual([
      {
        type: "button",
        from: "919829012345",
        messageId: "wamid.1",
        payload: "approve:x",
        text: "Approve",
      },
      { type: "text", from: "919829012345", messageId: "wamid.2", text: "Use the Diwali photo" },
      { type: "status", providerMessageId: "wamid.out", status: "delivered", error: null },
      {
        type: "status",
        providerMessageId: "wamid.bad",
        status: "failed",
        error: "Re-engagement needed",
      },
    ]);
  });

  it("ignores events for another phone number and junk", () => {
    expect(
      parseMetaWebhook(
        hook("9999", { messages: [{ from: "1", id: "x", type: "text", text: { body: "hi" } }] }),
        ours,
      ),
    ).toEqual([]);
    expect(parseMetaWebhook(null, ours)).toEqual([]);
    expect(parseMetaWebhook({ entry: "nope" }, ours)).toEqual([]);
  });
});

describe("MetaCloudWhatsApp", () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.sent" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const wa = new MetaCloudWhatsApp(
    {
      accessToken: "tok",
      phoneNumberId: "1111",
      graphVersion: "v23.0",
      templates: { approval: "post_approval_request", reminder: "approval_reminder" },
      defaultHeaderImage: "https://app.example/whatsapp-post-header.jpg",
    },
    fakeFetch,
  );

  it("sends the approval template with photo, five body values and two answer buttons", async () => {
    const r = await wa.sendApprovalRequest({
      to: "+919829012345",
      language: "hi",
      ownerName: "Ramesh",
      businessName: "Sharma Battery House",
      postPreview: "New stock",
      goLiveText: "on 20 Nov, 10:30 am",
      approvalLink: "https://app.example/approve/abc",
      photoUrl: "https://img.example/p.jpg",
      approvalId: "0b0e7c9e-1a2b-4c3d-8e9f-001122334455",
    });
    expect(r.providerMessageId).toBe("wamid.sent");
    const { url, body } = calls.at(-1)!;
    expect(url).toBe("https://graph.facebook.com/v23.0/1111/messages");
    expect(body).toMatchObject({
      messaging_product: "whatsapp",
      to: "919829012345",
      type: "template",
      template: { name: "post_approval_request", language: { code: "hi" } },
    });
    const components = (body.template as { components: Record<string, unknown>[] }).components;
    expect(components[0]).toMatchObject({ type: "header" });
    expect((components[1].parameters as unknown[]).length).toBe(5);
    expect(components[2]).toMatchObject({
      sub_type: "quick_reply",
      index: "0",
      parameters: [{ payload: "approve:0b0e7c9e-1a2b-4c3d-8e9f-001122334455" }],
    });
    expect(components[3]).toMatchObject({
      index: "1",
      parameters: [{ payload: "change:0b0e7c9e-1a2b-4c3d-8e9f-001122334455" }],
    });
  });

  it("always sends the header image Meta requires, using a standard picture for text-only posts", async () => {
    await wa.sendApprovalRequest({
      to: "+919829012345",
      language: "en",
      ownerName: "Ramesh",
      businessName: "Sharma Battery House",
      postPreview: "Diwali offer",
      goLiveText: "as soon as you approve",
      approvalLink: "https://app.example/approve/xyz",
      photoUrl: null,
      approvalId: "0b0e7c9e-1a2b-4c3d-8e9f-001122334455",
    });
    const components = (calls.at(-1)!.body.template as { components: Record<string, unknown>[] })
      .components;
    expect(components[0]).toEqual({
      type: "header",
      parameters: [
        { type: "image", image: { link: "https://app.example/whatsapp-post-header.jpg" } },
      ],
    });
  });

  it("explains a refused message", async () => {
    const refusing = new MetaCloudWhatsApp(
      {
        accessToken: "t",
        phoneNumberId: "1",
        graphVersion: "v23.0",
        templates: { approval: "a", reminder: "r" },
        defaultHeaderImage: "https://app.example/h.jpg",
      },
      (async () =>
        new Response(JSON.stringify({ error: { message: "Template not found" } }), {
          status: 400,
        })) as unknown as typeof fetch,
    );
    await expect(refusing.sendText("+911", "hi")).rejects.toThrow(/Template not found/);
  });
});

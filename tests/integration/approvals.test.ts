/**
 * M7 approval logic against the real Supabase project: send, approve by link, answer on
 * WhatsApp, owner notes, expiry and reminders. Uses a recording stand-in for WhatsApp.
 * Throwaway tagged data, deleted afterwards.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expireAndRemind,
  getApprovalByToken,
  handleInboundEvents,
  respondByToken,
  sendPostForApproval,
} from "@/lib/approvals/service";
import type { MessagingProvider } from "@/lib/messaging/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && secretKey);

const tag = `appr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
// An unassigned-looking test number, unique per run so it can't match a real client.
const ownerNumber = `+9199${String(Date.now()).slice(-8)}`;
const strangerNumber = "+919000000001";

class RecordingWhatsApp implements MessagingProvider {
  readonly kind = "mock" as const;
  sent: { kind: string; to: string; text?: string; approvalId?: string }[] = [];
  private id = () => ({ providerMessageId: `mock-${crypto.randomUUID()}` });
  async sendApprovalRequest(m: { to: string; approvalId: string }) {
    this.sent.push({ kind: "request", to: m.to, approvalId: m.approvalId });
    return this.id();
  }
  async sendApprovalReminder(m: { to: string; approvalId: string }) {
    this.sent.push({ kind: "reminder", to: m.to, approvalId: m.approvalId });
    return this.id();
  }
  async sendText(to: string, text: string) {
    this.sent.push({ kind: "text", to, text });
    return this.id();
  }
}

describe.skipIf(!configured)("approvals (service, real database)", () => {
  let service: SupabaseClient;
  let userId = "";
  let waClient = "";
  let linkClient = "";
  let wa: RecordingWhatsApp;

  const newPost = async (clientId: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await service
      .from("posts")
      .insert({
        client_id: clientId,
        language: "en",
        body: `${tag} New inverter batteries in stock. Visit us today!`,
        source_note: `${tag} note`,
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };
  const postStatus = async (id: string) =>
    (await service.from("posts").select("status, scheduled_for").eq("id", id).single()).data!;
  const approvalOf = async (postId: string) =>
    (
      await service
        .from("approvals")
        .select("*")
        .eq("subject_id", postId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
    ).data!;
  const tokenOf = (link: string) => link.split("/approve/")[1];

  beforeAll(async () => {
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });
    const { data: u, error } = await service.auth.admin.createUser({
      email: `${tag}-manager@example.com`,
      email_confirm: true,
      app_metadata: { role: "manager" },
    });
    if (error) throw error;
    userId = u.user.id;
    const { data: clients, error: cErr } = await service
      .from("clients")
      .insert([
        {
          business_name: `${tag} WA Battery`,
          owner_name: "Ramesh",
          owner_whatsapp: ownerNumber,
          whatsapp_opt_in_at: new Date().toISOString(),
          assigned_manager_id: userId,
        },
        { business_name: `${tag} Link Solar`, assigned_manager_id: userId },
      ])
      .select("id, business_name");
    if (cErr) throw cErr;
    waClient = clients.find((c) => c.business_name.includes("WA"))!.id;
    linkClient = clients.find((c) => c.business_name.includes("Link"))!.id;
  }, 60_000);

  beforeEach(() => {
    wa = new RecordingWhatsApp();
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("messages").delete().in("client_id", [waClient, linkClient].filter(Boolean));
    await service.from("messages").delete().in("to_number", [ownerNumber, strangerNumber]);
    await service.from("messages").delete().in("from_number", [ownerNumber, strangerNumber]);
    await service.from("clients").delete().in("id", [waClient, linkClient].filter(Boolean));
    if (userId) await service.auth.admin.deleteUser(userId);
  }, 60_000);

  it("owner without WhatsApp consent gets a link only; approving schedules the post", async () => {
    const postId = await newPost(linkClient);
    const r = await sendPostForApproval({ postId, userId, messaging: wa });
    expect(r.channel).toBe("web");
    expect(wa.sent).toEqual([]);
    expect((await postStatus(postId)).status).toBe("pending_approval");

    const a = await approvalOf(postId);
    expect(a.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token_hash).not.toBe(tokenOf(r.link));

    const view = await getApprovalByToken(tokenOf(r.link));
    expect(view).toMatchObject({ status: "pending", businessName: `${tag} Link Solar` });

    expect(await respondByToken(tokenOf(r.link), "approved", null)).toBe("approved");
    const p = await postStatus(postId);
    expect(p.status).toBe("scheduled");
    expect(p.scheduled_for).not.toBeNull(); // "as soon as approved"

    // Single use: a second answer changes nothing.
    expect(await respondByToken(tokenOf(r.link), "changes_requested", "late")).toBe("approved");
    expect((await postStatus(postId)).status).toBe("scheduled");
  });

  it("approved content is frozen", async () => {
    const postId = await newPost(linkClient);
    const r = await sendPostForApproval({ postId, userId, messaging: wa });
    await respondByToken(tokenOf(r.link), "approved", null);
    const edit = await service.from("posts").update({ body: "sneaky edit" }).eq("id", postId);
    expect(edit.error?.code).toBe("23514");
  });

  it("a post can't be sent twice while waiting, and rule-breaking text can't be sent", async () => {
    const postId = await newPost(linkClient);
    await sendPostForApproval({ postId, userId, messaging: wa });
    await expect(sendPostForApproval({ postId, userId, messaging: wa })).rejects.toThrow(
      /already been sent/,
    );
    const bad = await newPost(linkClient, { body: "Call 98290 12345 now" });
    await expect(sendPostForApproval({ postId: bad, userId, messaging: wa })).rejects.toThrow(
      /Fix the post text/,
    );
    expect((await postStatus(bad)).status).toBe("draft");
  });

  it("WhatsApp: request goes to the owner; their 'Request change' tap and note come back", async () => {
    const postId = await newPost(waClient);
    const r = await sendPostForApproval({ postId, userId, messaging: wa });
    expect(r.channel).toBe("whatsapp");
    expect(r.whatsappError).toBeNull();
    const a = await approvalOf(postId);
    expect(wa.sent).toEqual([{ kind: "request", to: ownerNumber, approvalId: a.id }]);
    expect(a.wa_message_id).toMatch(/^mock-/);

    // The logged message never contains the approval link (it carries the token).
    const { data: logged } = await service
      .from("messages")
      .select("body, payload")
      .eq("provider_message_id", a.wa_message_id)
      .single();
    expect(JSON.stringify(logged)).not.toContain(tokenOf(r.link));

    // Someone else's number can't answer.
    await handleInboundEvents(
      [
        {
          type: "button",
          from: strangerNumber.slice(1),
          messageId: `${tag}-s1`,
          payload: `approve:${a.id}`,
          text: "Approve",
        },
      ],
      wa,
    );
    expect((await postStatus(postId)).status).toBe("pending_approval");

    // The owner taps "Request change", then types a note.
    await handleInboundEvents(
      [
        {
          type: "button",
          from: ownerNumber.slice(1),
          messageId: `${tag}-o1`,
          payload: `change:${a.id}`,
          text: "Request change",
        },
      ],
      wa,
    );
    expect((await postStatus(postId)).status).toBe("changes_requested");
    await handleInboundEvents(
      [
        {
          type: "text",
          from: ownerNumber.slice(1),
          messageId: `${tag}-o2`,
          text: "Please mention the Diwali offer",
        },
      ],
      wa,
    );
    const after = await approvalOf(postId);
    expect(after).toMatchObject({
      status: "changes_requested",
      responded_via: "whatsapp",
      response_note: "Please mention the Diwali offer",
    });
    expect(wa.sent.filter((m) => m.kind === "text").length).toBe(2); // two polite replies

    // Same webhook delivered twice: nothing changes, no error.
    await handleInboundEvents(
      [
        {
          type: "button",
          from: ownerNumber.slice(1),
          messageId: `${tag}-o1`,
          payload: `change:${a.id}`,
          text: "Request change",
        },
      ],
      wa,
    );
    expect((await approvalOf(postId)).response_note).toBe("Please mention the Diwali offer");

    // The manager fixes it and sends again; the owner approves on WhatsApp.
    await service
      .from("posts")
      .update({ body: `${tag} Diwali offer on inverter batteries!` })
      .eq("id", postId);
    await sendPostForApproval({ postId, userId, messaging: wa });
    const second = await approvalOf(postId);
    expect(second.id).not.toBe(a.id);
    await handleInboundEvents(
      [
        {
          type: "button",
          from: ownerNumber.slice(1),
          messageId: `${tag}-o3`,
          payload: `approve:${second.id}`,
          text: "Approve",
        },
      ],
      wa,
    );
    expect((await postStatus(postId)).status).toBe("scheduled");
    // The old request's buttons are dead.
    await handleInboundEvents(
      [
        {
          type: "button",
          from: ownerNumber.slice(1),
          messageId: `${tag}-o4`,
          payload: `approve:${a.id}`,
          text: "Approve",
        },
      ],
      wa,
    );
    expect((await approvalOf(postId)).id).toBe(second.id);
  });

  it("no answer in 72 h: the request expires and nothing can approve it afterwards", async () => {
    const postId = await newPost(linkClient);
    const r = await sendPostForApproval({ postId, userId, messaging: wa });
    await service
      .from("approvals")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("subject_id", postId);

    const view = await getApprovalByToken(tokenOf(r.link));
    expect(view?.status).toBe("expired");
    expect(await respondByToken(tokenOf(r.link), "approved", null)).toBe("expired");
    expect((await postStatus(postId)).status).toBe("expired");

    // The manager can send it again after an expiry.
    const again = await sendPostForApproval({ postId, userId, messaging: wa });
    expect(again.link).not.toBe(r.link);
    expect((await postStatus(postId)).status).toBe("pending_approval");
  });

  it("the scheduled job expires overdue requests and sends one reminder after 24 h", async () => {
    const overdue = await newPost(waClient);
    await sendPostForApproval({ postId: overdue, userId, messaging: wa });
    await service
      .from("approvals")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("subject_id", overdue);

    const quiet = await newPost(waClient);
    await sendPostForApproval({ postId: quiet, userId, messaging: wa });
    await service
      .from("approvals")
      .update({ created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() })
      .eq("subject_id", quiet);

    wa = new RecordingWhatsApp();
    const first = await expireAndRemind(wa);
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect((await postStatus(overdue)).status).toBe("expired");
    const quietApproval = await approvalOf(quiet);
    expect(wa.sent).toContainEqual({
      kind: "reminder",
      to: ownerNumber,
      approvalId: quietApproval.id,
    });
    expect(quietApproval.reminded_at).not.toBeNull();

    wa = new RecordingWhatsApp();
    await expireAndRemind(wa);
    expect(wa.sent.filter((m) => m.approvalId === quietApproval.id)).toEqual([]); // only once
  });

  it("garbage or unknown links show nothing", async () => {
    expect(await getApprovalByToken("nope")).toBeNull();
    expect(await getApprovalByToken("A".repeat(43))).toBeNull();
    await expect(respondByToken("A".repeat(43), "approved", null)).rejects.toThrow(/isn't valid/);
  });
});

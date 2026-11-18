/**
 * Access rules and guardrails for photos and posts (M6 migration), against the real
 * Supabase project. Throwaway tagged data, deleted afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const tag = `posttest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const password = `Pw-${crypto.randomUUID()}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const people = {
  admin: "admin",
  managerA: "manager",
  managerB: "manager",
  ownerA: "client",
} as const;

describe.skipIf(!configured)("posts and photos: row-level security and guardrails", () => {
  const ids: Record<string, string> = {};
  const as: Record<string, SupabaseClient> = {};
  let service: SupabaseClient;
  let clientA = "";
  let clientB = "";

  const post = (client: string, extra: Record<string, unknown> = {}) => ({
    client_id: client,
    language: "en",
    body: `${tag} body`,
    source_note: `${tag} note`,
    ...extra,
  });

  beforeAll(async () => {
    service = createClient(url!, secretKey!, noSession);
    for (const [name, role] of Object.entries(people)) {
      const { data, error } = await service.auth.admin.createUser({
        email: `${tag}-${name.toLowerCase()}@example.com`,
        password,
        email_confirm: true,
        app_metadata: { role },
      });
      if (error) throw error;
      ids[name] = data.user.id;
    }
    const { data: clients, error } = await service
      .from("clients")
      .insert([
        { business_name: `${tag} A`, assigned_manager_id: ids.managerA },
        { business_name: `${tag} B`, assigned_manager_id: ids.managerB },
      ])
      .select("id, business_name");
    if (error) throw error;
    clientA = clients.find((c) => c.business_name.endsWith(" A"))!.id;
    clientB = clients.find((c) => c.business_name.endsWith(" B"))!.id;
    await service.from("client_users").insert({ client_id: clientA, user_id: ids.ownerA });

    const { error: pErr } = await service.from("posts").insert(
      [
        post(clientA, { source_note: `${tag} A draft` }),
        post(clientA, { source_note: `${tag} A sent`, status: "pending_approval" }),
        post(clientB, { source_note: `${tag} B draft` }),
      ],
      // Rows that leave out "status" get the column default, not null.
      { defaultToNull: false },
    );
    if (pErr) throw pErr;

    for (const name of Object.keys(people)) {
      const c = createClient(url!, publishableKey!, noSession);
      const { error: sErr } = await c.auth.signInWithPassword({
        email: `${tag}-${name.toLowerCase()}@example.com`,
        password,
      });
      if (sErr) throw sErr;
      as[name] = c;
    }
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    await service.from("clients").delete().in("id", [clientA, clientB].filter(Boolean));
    for (const id of Object.values(ids)) await service.auth.admin.deleteUser(id);
  }, 60_000);

  const notes = async (c: SupabaseClient) =>
    ((await c.from("posts").select("source_note").like("source_note", `${tag}%`)).data ?? [])
      .map((p) => p.source_note.replace(`${tag} `, ""))
      .sort();

  it("team sees their clients' posts; owners see only posts sent to them, never drafts", async () => {
    expect(await notes(as.admin)).toEqual(["A draft", "A sent", "B draft"]);
    expect(await notes(as.managerA)).toEqual(["A draft", "A sent"]);
    expect(await notes(as.managerB)).toEqual(["B draft"]);
    expect(await notes(as.ownerA)).toEqual(["A sent"]);
  });

  it("signed-in users can't create, edit or delete posts directly", async () => {
    const ins = await as.admin.from("posts").insert(post(clientA));
    expect(ins.error).not.toBeNull();
    const upd = await as.managerA
      .from("posts")
      .update({ body: "hacked" })
      .like("source_note", `${tag}%`)
      .select("id");
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const del = await as.admin.from("posts").delete().like("source_note", `${tag}%`).select("id");
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
  });

  it("no post can be scheduled or published without client approval — not even by the server", async () => {
    for (const status of ["scheduled", "publishing", "published"]) {
      const ins = await service.from("posts").insert(post(clientA, { status }));
      expect(ins.error?.code, status).toBe("23514");
    }
    const upd = await service
      .from("posts")
      .update({ status: "scheduled" })
      .eq("source_note", `${tag} A draft`);
    expect(upd.error?.code).toBe("23514");
  });

  it("enforces Google's 1,500-character limit and https-only button links", async () => {
    const long = await service.from("posts").insert(post(clientA, { body: "x".repeat(1501) }));
    expect(long.error?.code).toBe("23514");
    const http = await service
      .from("posts")
      .insert(post(clientA, { cta_type: "LEARN_MORE", cta_url: "http://example.com" }));
    expect(http.error?.code).toBe("23514");
  });

  it("photos are private: signed-in users can't read or upload to the media bucket", async () => {
    const path = `${clientA}/${tag}.jpg`;
    const up = await as.admin.storage
      .from("media")
      .upload(path, new Blob([new Uint8Array(20_000)], { type: "image/jpeg" }));
    expect(up.error).not.toBeNull();

    await service.storage
      .from("media")
      .upload(path, new Blob([new Uint8Array(20_000)], { type: "image/jpeg" }));
    try {
      const list = await as.managerA.storage.from("media").list(clientA);
      expect(list.data ?? []).toEqual([]);
      const dl = await as.managerA.storage.from("media").download(path);
      expect(dl.data).toBeNull();
    } finally {
      await service.storage.from("media").remove([path]);
    }
  });
});

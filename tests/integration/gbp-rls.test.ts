/**
 * Access rules for Google connections and linked profiles (M4 migration), against the
 * real Supabase project. Throwaway tagged data, deleted afterwards.
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

const tag = `gbptest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const password = `Pw-${crypto.randomUUID()}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const people = {
  admin: "admin",
  managerA: "manager",
  managerB: "manager",
  clientA: "client",
} as const;

describe.skipIf(!configured)("Google connections and locations: row-level security", () => {
  const ids: Record<string, string> = {};
  const as: Record<string, SupabaseClient> = {};
  let service: SupabaseClient;
  let clientA = "";
  let clientB = "";
  let connectionId = "";

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
    const { data: clients, error: cErr } = await service
      .from("clients")
      .insert([
        { business_name: `${tag} A`, assigned_manager_id: ids.managerA },
        { business_name: `${tag} B`, assigned_manager_id: ids.managerB },
      ])
      .select("id, business_name");
    if (cErr) throw cErr;
    clientA = clients.find((c) => c.business_name.endsWith(" A"))!.id;
    clientB = clients.find((c) => c.business_name.endsWith(" B"))!.id;
    await service.from("client_users").insert({ client_id: clientA, user_id: ids.clientA });

    const { data: conn, error: connErr } = await service
      .from("gbp_connections")
      .insert({
        provider: "mock",
        mode: "agency_manager",
        google_account_name: `accounts/${tag}`,
        google_account_label: "test",
        refresh_token_encrypted: "pretend-secret",
      })
      .select("id")
      .single();
    if (connErr) throw connErr;
    connectionId = conn.id;

    const { error: locErr } = await service.from("locations").insert([
      {
        client_id: clientA,
        connection_id: connectionId,
        gbp_account_name: `accounts/${tag}`,
        gbp_location_name: `locations/${tag}-a`,
        title: `${tag} loc A`,
        place_id: "PLACE_A",
        snapshot: {},
      },
      {
        client_id: clientB,
        connection_id: connectionId,
        gbp_account_name: `accounts/${tag}`,
        gbp_location_name: `locations/${tag}-b`,
        title: `${tag} loc B`,
        snapshot: {},
      },
    ]);
    if (locErr) throw locErr;

    for (const name of Object.keys(people)) {
      const c = createClient(url!, publishableKey!, noSession);
      const { error } = await c.auth.signInWithPassword({
        email: `${tag}-${name.toLowerCase()}@example.com`,
        password,
      });
      if (error) throw error;
      as[name] = c;
    }
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    await service.from("locations").delete().like("gbp_location_name", `locations/${tag}%`);
    await service.from("gbp_connections").delete().eq("google_account_name", `accounts/${tag}`);
    await service.from("clients").delete().in("id", [clientA, clientB].filter(Boolean));
    for (const id of Object.values(ids)) await service.auth.admin.deleteUser(id);
  }, 60_000);

  const titles = async (c: SupabaseClient) =>
    ((await c.from("locations").select("title").like("title", `${tag}%`)).data ?? [])
      .map((l) => l.title)
      .sort();

  it("nobody signed in can read Google credentials — not even an admin", async () => {
    for (const who of Object.keys(people)) {
      const { data } = await as[who].from("gbp_connections").select("*").eq("id", connectionId);
      expect(data ?? [], who).toEqual([]);
    }
  });

  it("nobody signed in can create or change a connection", async () => {
    const insert = await as.admin.from("gbp_connections").insert({
      provider: "mock",
      mode: "agency_manager",
      google_account_name: `accounts/${tag}-evil`,
    });
    expect(insert.error).not.toBeNull();
  });

  it("linked profiles follow client access", async () => {
    expect(await titles(as.admin)).toEqual([`${tag} loc A`, `${tag} loc B`]);
    expect(await titles(as.managerA)).toEqual([`${tag} loc A`]);
    expect(await titles(as.managerB)).toEqual([`${tag} loc B`]);
    expect(await titles(as.clientA)).toEqual([`${tag} loc A`]);
  });

  it("the review link is Google's official one, built from the place ID", async () => {
    const { data } = await as.clientA
      .from("locations")
      .select("review_url")
      .like("title", `${tag}%`)
      .single();
    expect(data!.review_url).toBe("https://search.google.com/local/writereview?placeid=PLACE_A");
  });

  it("signed-in users can't link, edit or unlink profiles directly", async () => {
    const upd = await as.managerA
      .from("locations")
      .update({ title: "hacked" })
      .eq("gbp_location_name", `locations/${tag}-a`)
      .select("id");
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);

    const del = await as.admin
      .from("locations")
      .delete()
      .eq("gbp_location_name", `locations/${tag}-b`)
      .select("id");
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    expect(await titles(as.admin)).toHaveLength(2);
  });

  it("one Google profile can't be linked to two clients", async () => {
    const dup = await service.from("locations").insert({
      client_id: clientB,
      connection_id: connectionId,
      gbp_account_name: `accounts/${tag}`,
      gbp_location_name: `locations/${tag}-a`,
      title: "dup",
      snapshot: {},
    });
    expect(dup.error?.code).toBe("23505");
  });
});

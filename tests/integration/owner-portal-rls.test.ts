/**
 * Access rules for the owner-portal tables (20261122120000_owner_portal.sql), against the
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

const tag = `ownrls-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const password = `Pw-${crypto.randomUUID()}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

const TABLES = [
  "reviews",
  "location_metrics_daily",
  "change_requests",
  "notifications",
  "support_tickets",
  "card_events",
  "review_feedback",
] as const;

describe.skipIf(!configured)("owner portal tables: row-level security", () => {
  let service: SupabaseClient;
  const users: Record<"ownerA" | "managerB", { id: string; client: SupabaseClient }> = {} as never;
  let clientA = "";
  let clientB = "";
  let connectionId = "";

  beforeAll(async () => {
    service = createClient(url!, secretKey!, noSession);
    for (const [name, role] of [
      ["ownerA", "client"],
      ["managerB", "manager"],
    ] as const) {
      const email = `${tag}-${name.toLowerCase()}@example.com`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
      });
      if (error) throw error;
      const client = createClient(url!, publishableKey!, noSession);
      const { error: sErr } = await client.auth.signInWithPassword({ email, password });
      if (sErr) throw sErr;
      users[name] = { id: data.user.id, client };
    }
    const { data: clients, error } = await service
      .from("clients")
      .insert([
        { business_name: `${tag} A` },
        { business_name: `${tag} B`, assigned_manager_id: users.managerB.id },
      ])
      .select("id, business_name");
    if (error) throw error;
    clientA = clients.find((c) => c.business_name.endsWith(" A"))!.id;
    clientB = clients.find((c) => c.business_name.endsWith(" B"))!.id;
    await service.from("client_users").insert({ client_id: clientA, user_id: users.ownerA.id });

    const { data: conn } = await service
      .from("gbp_connections")
      .insert({ provider: "mock", mode: "agency_manager", google_account_name: `accounts/${tag}` })
      .select("id")
      .single();
    connectionId = conn!.id;
    const { data: locs } = await service
      .from("locations")
      .insert(
        [clientA, clientB].map((c, i) => ({
          client_id: c,
          connection_id: connectionId,
          gbp_account_name: `accounts/${tag}`,
          gbp_location_name: `locations/${tag}-${i}`,
          title: `${tag} ${i}`,
          snapshot: {},
        })),
      )
      .select("id, client_id");
    for (const c of [clientA, clientB]) {
      const loc = locs!.find((l) => l.client_id === c)!.id;
      const results = await Promise.all([
        service.from("reviews").insert({
          location_id: loc,
          client_id: c,
          gbp_review_name: `${tag}-${c}`,
          reviewer: "R",
          star_rating: 5,
          reviewed_at: new Date().toISOString(),
        }),
        service
          .from("location_metrics_daily")
          .insert({ location_id: loc, client_id: c, day: "2026-11-01" }),
        service
          .from("change_requests")
          .insert({ client_id: c, area: "info", message: "change it" }),
        service.from("notifications").insert({ client_id: c, kind: "general", title: "hi" }),
        service.from("support_tickets").insert({
          client_id: c,
          subject: "help me",
          category: "other",
          description: "please help me out",
        }),
        service.from("card_events").insert({ client_id: c, kind: "view" }),
        service.from("review_feedback").insert({ client_id: c, message: "private note" }),
      ]);
      for (const r of results) if (r.error) throw r.error;
    }
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("locations").delete().in("client_id", [clientA, clientB]);
    await service.from("clients").delete().in("id", [clientA, clientB]);
    if (connectionId) await service.from("gbp_connections").delete().eq("id", connectionId);
    for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  });

  it.each(TABLES)("an owner reads only their own business's %s", async (table) => {
    const { data, error } = await users.ownerA.client
      .from(table)
      .select("client_id")
      .in("client_id", [clientA, clientB]);
    expect(error).toBeNull();
    expect(data?.map((r) => r.client_id)).toEqual([clientA]);
  });

  it.each(TABLES)("a manager reads only their assigned client's %s", async (table) => {
    const { data } = await users.managerB.client
      .from(table)
      .select("client_id")
      .in("client_id", [clientA, clientB]);
    expect(data?.map((r) => r.client_id)).toEqual([clientB]);
  });

  it("owners can't write these tables directly (only through checked server code)", async () => {
    const tries = await Promise.all([
      users.ownerA.client
        .from("change_requests")
        .insert({ client_id: clientA, area: "info", message: "sneaky" }),
      users.ownerA.client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", clientA)
        .select(),
      users.ownerA.client.from("reviews").delete().eq("client_id", clientA).select(),
      users.ownerA.client
        .from("support_tickets")
        .update({ status: "resolved" })
        .eq("client_id", clientA)
        .select(),
    ]);
    // Each attempt is either refused outright or touches no rows.
    for (const t of tries) if (!t.error) expect(t.data ?? []).toHaveLength(0);
    expect(tries[0].error).not.toBeNull();
    const { data } = await service
      .from("notifications")
      .select("read_at")
      .eq("client_id", clientA)
      .single();
    expect(data?.read_at).toBeNull();
  });
});

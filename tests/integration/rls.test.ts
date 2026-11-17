/**
 * Proves the access rules in supabase/migrations against a real Supabase project.
 * Creates throwaway users/clients (tagged), checks who can see/do what, then deletes them.
 * Run: npm run test:db   (needs .env.local with Supabase URL + publishable + secret keys)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI or no local env file — the suite skips below.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const tag = `rlstest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const password = `Pw-${crypto.randomUUID()}`;
type Role = "admin" | "manager" | "client" | null;
const people: Record<string, Role> = {
  admin: "admin",
  managerA: "manager",
  managerB: "manager",
  clientA: "client",
  nobody: null,
};

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

describe.skipIf(!configured)("row-level security", () => {
  const ids: Record<string, string> = {};
  const as: Record<string, SupabaseClient> = {};
  let service: SupabaseClient;
  let clientAId = "";
  let clientBId = "";

  beforeAll(async () => {
    service = createClient(url!, secretKey!, noSession);

    for (const [name, role] of Object.entries(people)) {
      const { data, error } = await service.auth.admin.createUser({
        email: `${tag}-${name.toLowerCase()}@example.com`,
        password,
        email_confirm: true,
        app_metadata: role ? { role } : {},
        user_metadata: { full_name: `${tag} ${name}` },
      });
      if (error) throw new Error(`createUser ${name}: ${error.message}`);
      ids[name] = data.user.id;
    }

    const { data: created, error } = await service
      .from("clients")
      .insert([
        { business_name: `${tag} A Batteries`, assigned_manager_id: ids.managerA },
        { business_name: `${tag} B Solar`, assigned_manager_id: ids.managerB },
      ])
      .select("id, business_name");
    if (error) throw new Error(`insert clients: ${error.message}`);
    clientAId = created.find((c) => c.business_name.includes(" A "))!.id;
    clientBId = created.find((c) => c.business_name.includes(" B "))!.id;

    const link = await service
      .from("client_users")
      .insert({ client_id: clientAId, user_id: ids.clientA });
    if (link.error) throw new Error(`link client user: ${link.error.message}`);

    for (const name of Object.keys(people)) {
      const c = createClient(url!, publishableKey!, noSession);
      const { error: signInError } = await c.auth.signInWithPassword({
        email: `${tag}-${name.toLowerCase()}@example.com`,
        password,
      });
      if (signInError) throw new Error(`sign in ${name}: ${signInError.message}`);
      as[name] = c;
    }
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    await service.from("clients").delete().in("id", [clientAId, clientBId].filter(Boolean));
    for (const id of Object.values(ids)) await service.auth.admin.deleteUser(id);
  }, 60_000);

  async function visibleClientIds(c: SupabaseClient) {
    const { data, error } = await c.from("clients").select("id").like("business_name", `${tag}%`);
    expect(error).toBeNull();
    return (data ?? []).map((r) => r.id).sort();
  }

  it("gives new accounts the role from app_metadata, and no role otherwise", async () => {
    const { data } = await service.from("profiles").select("id, role").in("id", Object.values(ids));
    const roleOf = (name: string) => data!.find((p) => p.id === ids[name])!.role;
    expect(roleOf("admin")).toBe("admin");
    expect(roleOf("managerA")).toBe("manager");
    expect(roleOf("clientA")).toBe("client");
    expect(roleOf("nobody")).toBeNull();
  });

  it("admin sees every client", async () => {
    expect(await visibleClientIds(as.admin)).toEqual([clientAId, clientBId].sort());
  });

  it("each manager sees only their assigned clients", async () => {
    expect(await visibleClientIds(as.managerA)).toEqual([clientAId]);
    expect(await visibleClientIds(as.managerB)).toEqual([clientBId]);
  });

  it("a client user sees only their own business", async () => {
    expect(await visibleClientIds(as.clientA)).toEqual([clientAId]);
  });

  it("an account with no role sees nothing", async () => {
    expect(await visibleClientIds(as.nobody)).toEqual([]);
  });

  it("signed-out visitors can't read clients", async () => {
    const anon = createClient(url!, publishableKey!, noSession);
    const { data } = await anon.from("clients").select("id").like("business_name", `${tag}%`);
    expect(data ?? []).toEqual([]);
  });

  it("a manager can edit their own client but not someone else's", async () => {
    const own = await as.managerA
      .from("clients")
      .update({ brand_notes: "Friendly, mention 2-year warranty" })
      .eq("id", clientAId)
      .select("id");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const other = await as.managerA
      .from("clients")
      .update({ brand_notes: "hijack" })
      .eq("id", clientBId)
      .select("id");
    expect(other.data ?? []).toHaveLength(0);
  });

  it("only an admin can reassign a client to another manager", async () => {
    const byManager = await as.managerA
      .from("clients")
      .update({ assigned_manager_id: ids.managerB })
      .eq("id", clientAId)
      .select("id");
    expect(byManager.error).not.toBeNull();

    const byAdmin = await as.admin
      .from("clients")
      .update({ assigned_manager_id: ids.managerA })
      .eq("id", clientAId)
      .select("id");
    expect(byAdmin.error).toBeNull();
    expect(byAdmin.data).toHaveLength(1);
  });

  it("managers and clients can't create clients or link users", async () => {
    for (const who of ["managerA", "clientA", "nobody"]) {
      const insert = await as[who].from("clients").insert({ business_name: `${tag} sneaky` });
      expect(insert.error, who).not.toBeNull();
      const link = await as[who]
        .from("client_users")
        .insert({ client_id: clientBId, user_id: ids[who] });
      expect(link.error, who).not.toBeNull();
    }
  });

  it("nobody can give themselves a role", async () => {
    const res = await as.nobody.from("profiles").update({ role: "admin" }).eq("id", ids.nobody);
    expect(res.error).not.toBeNull();
    const { data } = await service.from("profiles").select("role").eq("id", ids.nobody).single();
    expect(data!.role).toBeNull();
  });

  it("users can update their own name", async () => {
    const res = await as.clientA
      .from("profiles")
      .update({ full_name: `${tag} Renamed` })
      .eq("id", ids.clientA)
      .select("full_name");
    expect(res.error).toBeNull();
    expect(res.data![0].full_name).toBe(`${tag} Renamed`);
  });

  it("team members see the team, but clients don't see other people", async () => {
    const team = await as.managerA.from("profiles").select("id").in("id", Object.values(ids));
    const seenByManager = team.data!.map((p) => p.id);
    expect(seenByManager).toContain(ids.admin);
    expect(seenByManager).not.toContain(ids.clientA);

    const byClient = await as.clientA.from("profiles").select("id").in("id", Object.values(ids));
    expect(byClient.data!.map((p) => p.id)).toEqual([ids.clientA]);
  });
});

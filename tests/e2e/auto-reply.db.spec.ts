/**
 * Auto reply: the owner switches it on; on the next sync only new good reviews get the
 * thank-you. Real Supabase, sample Google provider; tagged data, deleted afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const tag = `e2eauto-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;
const ownerEmail = `${tag}-owner@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];
let clientId = "";
let locationId = "";
let locationName = "";

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  for (const [email, role] of [
    [adminEmail, "admin"],
    [ownerEmail, "client"],
  ] as const) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: `${tag} ${role}` },
    });
    if (error) throw error;
    userIds.push(data.user.id);
  }
  const { data: client, error } = await service
    .from("clients")
    .insert({ business_name: `${tag} Sun Power` })
    .select("id")
    .single();
  if (error) throw error;
  clientId = client.id;
  await service.from("client_users").insert({ client_id: clientId, user_id: userIds[1] });

  const accountName = `accounts/sample-owner-${tag}`;
  const { data: conn, error: connErr } = await service
    .from("gbp_connections")
    .insert({
      provider: "mock",
      mode: "owner_oauth",
      client_id: clientId,
      google_account_name: accountName,
      google_account_label: "sample",
    })
    .select("id")
    .single();
  if (connErr) throw connErr;
  const { MockGbpProvider } = await import("../../src/lib/gbp/mock/provider");
  const { collectSnapshot } = await import("../../src/lib/gbp/snapshot");
  const provider = new MockGbpProvider();
  const creds = { accountName, refreshToken: null };
  const [profile] = await provider.listLocations(creds);
  locationName = profile.name;
  // A real sample snapshot, as linking a profile would store.
  const snapshot = await collectSnapshot(provider, creds, profile.name);
  const { data: loc, error: locErr } = await service
    .from("locations")
    .insert({
      client_id: clientId,
      connection_id: conn.id,
      gbp_account_name: accountName,
      gbp_location_name: profile.name,
      title: profile.title,
      snapshot,
    })
    .select("id")
    .single();
  if (locErr) throw locErr;
  locationId = loc.id;
});

test.afterAll(async () => {
  if (!service) return;
  if (clientId) {
    await service.from("locations").delete().eq("client_id", clientId);
    await service.from("gbp_connections").delete().eq("client_id", clientId);
    await service.from("clients").delete().eq("id", clientId);
  }
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

async function signIn(page: Page, email: string, home: RegExp) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(home);
}

async function addReview(name: string, stars: number, minutesFromNow: number) {
  const { data, error } = await service
    .from("reviews")
    .insert({
      location_id: locationId,
      client_id: clientId,
      gbp_review_name: `${locationName}/reviews/${tag}-${name}`,
      reviewer: `${name} Kumar`,
      star_rating: stars,
      comment: `${tag} ${name} review`,
      reviewed_at: new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test("owner switches auto reply on; the next sync thanks only new good reviews", async ({
  page,
}) => {
  // A good review from before auto reply is switched on must never be answered automatically.
  const oldId = await addReview("Old", 5, -60);

  await signIn(page, ownerEmail, /\/home$/);
  await page.goto("/home/reviews/auto-reply");
  await expect(page.getByRole("heading", { level: 1, name: "Auto reply" })).toBeVisible();
  await page.getByRole("switch", { name: "Auto reply" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Auto reply is on.")).toBeVisible();

  const goodId = await addReview("Ravi", 5, 1);
  const lowId = await addReview("Meena", 2, 1);

  await signIn(page, adminEmail, /\/dashboard$/);
  await page.goto(`/clients/${clientId}`);
  await expect(page.getByRole("region", { name: "Auto reply" })).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText(/Auto reply thanked 1 new review/)).toBeVisible();

  const { data } = await service
    .from("reviews")
    .select("id, reply_comment, replied_by")
    .in("id", [oldId, goodId, lowId]);
  const byId = new Map((data ?? []).map((r) => [r.id, r]));
  expect(byId.get(goodId)).toMatchObject({
    replied_by: "auto",
    reply_comment: expect.stringMatching(/^Thank you, Ravi, for the wonderful review!/),
  });
  expect(byId.get(lowId)?.reply_comment).toBeNull();
  expect(byId.get(oldId)?.reply_comment).toBeNull();

  await signIn(page, ownerEmail, /\/home$/);
  await page.goto("/home/reviews/auto-reply");
  await expect(
    page.getByRole("region", { name: "Automatic replies" }).getByText("Ravi Kumar"),
  ).toBeVisible();
});

/**
 * M8: an approved post is published to Google (sample provider) and shown as live.
 * Real Supabase; tagged throwaway data, deleted afterwards. Local only.
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
const tag = `e2epub-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;

let service: SupabaseClient;
let adminId = "";
let clientId = "";
let unlinkedClientId = "";

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  const { data: user, error } = await service.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: `${tag} Admin` },
  });
  if (error) throw error;
  adminId = user.user.id;

  const { data: clients, error: cErr } = await service
    .from("clients")
    .insert([{ business_name: `${tag} Linked Solar` }, { business_name: `${tag} Unlinked Shop` }])
    .select("id, business_name");
  if (cErr) throw cErr;
  clientId = clients.find((c) => c.business_name.includes("Linked Solar"))!.id;
  unlinkedClientId = clients.find((c) => c.business_name.includes("Unlinked"))!.id;

  // A sample owner connection and profile the sample provider recognises.
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
  const [profile] = await new MockGbpProvider().listLocations({ accountName, refreshToken: null });
  const { error: locErr } = await service.from("locations").insert({
    client_id: clientId,
    connection_id: conn.id,
    gbp_account_name: accountName,
    gbp_location_name: profile.name,
    title: profile.title,
    snapshot: {},
  });
  if (locErr) throw locErr;
});

test.afterAll(async () => {
  if (!service) return;
  const ids = [clientId, unlinkedClientId].filter(Boolean);
  await service.from("posts").delete().in("client_id", ids);
  await service.from("locations").delete().in("client_id", ids);
  await service.from("gbp_connections").delete().in("client_id", ids);
  await service.from("clients").delete().in("id", ids);
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

/** An owner-approved post, due in the future so only "Publish now" sends it. */
async function approvedPost(forClient: string, body: string) {
  const { data: post, error } = await service
    .from("posts")
    .insert({
      client_id: forClient,
      language: "en",
      body,
      source_note: `${tag} note`,
      cta_type: "CALL",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: aErr } = await service.from("approvals").insert({
    subject_id: post.id,
    client_id: forClient,
    token_hash: `${tag}-${post.id}`,
    channel: "web",
    status: "approved",
    responded_at: new Date().toISOString(),
    responded_via: "web",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (aErr) throw aErr;
  const { error: sErr } = await service
    .from("posts")
    .update({
      status: "scheduled",
      scheduled_for: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .eq("id", post.id);
  if (sErr) throw sErr;
  return post.id as string;
}

async function signInAsAdmin(page: Page) {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
  });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("team publishes an approved post now; it goes live and the owner is told", async ({
  page,
}) => {
  const postId = await approvedPost(clientId, `${tag} Solar site surveys open this week.`);
  await signInAsAdmin(page);
  await page.goto(`/clients/${clientId}/posts/${postId}`);
  const panel = page.getByRole("region", { name: "Publishing on Google" });
  await expect(panel.getByText("Goes live")).toBeVisible();
  await panel.getByRole("button", { name: "Publish now" }).click();
  // The panel switches to its "live" state once published.
  await expect(panel.getByText(/Live on Google since/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Publishing on Google" }).getByText(/Live on Google since/),
  ).toBeVisible();

  const { data } = await service
    .from("posts")
    .select("status, gbp_post_name, published_at, publish_attempts, error")
    .eq("id", postId)
    .single();
  expect(data).toMatchObject({ status: "published", publish_attempts: 1, error: null });
  expect(data!.gbp_post_name).toMatch(/\/localPosts\/sample-/);
  const { data: note } = await service
    .from("notifications")
    .select("title")
    .eq("client_id", clientId)
    .eq("title", "Your post is live on Google")
    .maybeSingle();
  expect(note).not.toBeNull();
});

test("an approved post for a business without a linked profile waits instead of failing", async ({
  page,
}) => {
  const postId = await approvedPost(unlinkedClientId, `${tag} Battery exchange offer.`);
  await signInAsAdmin(page);
  await page.goto(`/clients/${unlinkedClientId}/posts/${postId}`);
  await page
    .getByRole("region", { name: "Publishing on Google" })
    .getByRole("button", { name: "Publish now" })
    .click();
  await expect(page.getByText(/Link this client's Google profile first/)).toBeVisible();
  const { data } = await service.from("posts").select("status").eq("id", postId).single();
  expect(data!.status).toBe("scheduled");
});

test("the publish job refuses callers without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/publish")).status()).toBe(401);
  const wrong = await request.get("/api/cron/publish", {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(wrong.status()).toBe(401);
});

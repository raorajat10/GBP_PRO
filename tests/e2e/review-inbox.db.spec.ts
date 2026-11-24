/**
 * M9: the team replies to a Google review from the inbox (sample provider).
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
const tag = `e2erev-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;
const managerEmail = `${tag}-manager@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];
let clientId = "";
let reviewId = "";

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  for (const [email, role] of [
    [adminEmail, "admin"],
    [managerEmail, "manager"],
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
  // Not assigned to the manager: they must not see its reviews.
  const { data: client, error } = await service
    .from("clients")
    .insert({ business_name: `${tag} Solar Works` })
    .select("id")
    .single();
  if (error) throw error;
  clientId = client.id;

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
  const { data: loc, error: locErr } = await service
    .from("locations")
    .insert({
      client_id: clientId,
      connection_id: conn.id,
      gbp_account_name: accountName,
      gbp_location_name: profile.name,
      title: profile.title,
      snapshot: {},
    })
    .select("id")
    .single();
  if (locErr) throw locErr;
  const { data: review, error: rErr } = await service
    .from("reviews")
    .insert({
      location_id: loc.id,
      client_id: clientId,
      gbp_review_name: `${profile.name}/reviews/${tag}`,
      reviewer: "Asha Verma",
      star_rating: 4,
      comment: `${tag} Good installation but the team came late.`,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (rErr) throw rErr;
  reviewId = review.id;
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

async function signIn(page: Page, email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("team picks a ready thank-you, edits it and posts it on Google", async ({ page }) => {
  await signIn(page, adminEmail);
  await page.getByRole("link", { name: "Reviews", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review inbox" })).toBeVisible();
  await page.goto(`/reviews?show=all&client=${clientId}`);

  const item = page.getByRole("listitem").filter({ hasText: `${tag} Good installation` });
  await item.getByRole("button", { name: "Reply", exact: true }).click();
  const box = item.getByLabel("Reply that goes on Google");
  // Opens with a ready thank-you, using the reviewer's first name and the business.
  await expect(box).toHaveValue(/^Thank you, Asha, for the wonderful review!/);
  await item.getByRole("button", { name: "Short" }).click();
  await expect(box).toHaveValue(/^Thank you, Asha, for your kind words!/);
  await box.fill("Thank you Asha! Sorry we were late; we've changed how we plan visits.");
  await item.getByRole("button", { name: "Post reply on Google" }).click();
  await expect(item.getByText("Reply posted on Google.")).toBeVisible();
  await expect(
    item.getByText("Sorry we were late; we've changed how we plan visits."),
  ).toBeVisible();

  const { data } = await service
    .from("reviews")
    .select("reply_comment, replied_at")
    .eq("id", reviewId)
    .single();
  expect(data!.reply_comment).toBe(
    "Thank you Asha! Sorry we were late; we've changed how we plan visits.",
  );
  expect(data!.replied_at).not.toBeNull();

  // Once replied, it leaves the "Needs a reply" list.
  await page.goto(`/reviews?client=${clientId}`);
  await expect(page.getByText("Every review has a reply. Nice work.")).toBeVisible();
});

test("a manager doesn't see reviews of clients they don't manage", async ({ page }) => {
  await signIn(page, managerEmail);
  await page.goto("/reviews?show=all");
  await expect(page.getByText(`${tag} Good installation`)).toHaveCount(0);
});

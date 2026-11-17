/**
 * M4 acceptance against the real Supabase project, using the sample (mock) Google provider.
 * Local only (npm run test:e2e:db). Tagged throwaway data, deleted afterwards.
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
const tag = `e2egbp-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;
const managerEmail = `${tag}-manager@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];
let assignedClient = "";
let otherClient = "";
let teamConnectionExisted = false;

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
  const { data: clients, error } = await service
    .from("clients")
    .insert([
      { business_name: `${tag} Assigned Solar`, assigned_manager_id: userIds[1] },
      { business_name: `${tag} Other Batteries` },
    ])
    .select("id, business_name");
  if (error) throw error;
  assignedClient = clients.find((c) => c.business_name.includes("Assigned"))!.id;
  otherClient = clients.find((c) => c.business_name.includes("Other"))!.id;

  const { data: existing } = await service
    .from("gbp_connections")
    .select("id")
    .eq("google_account_name", "accounts/sample-team")
    .maybeSingle();
  teamConnectionExisted = Boolean(existing);
});

test.afterAll(async () => {
  if (!service) return;
  const ids = [assignedClient, otherClient].filter(Boolean);
  await service.from("locations").delete().in("client_id", ids);
  await service.from("gbp_connections").delete().in("client_id", ids);
  await service.from("clients").delete().in("id", ids);
  if (!teamConnectionExisted) {
    // Remove the sample team connection only if this test created it and nothing uses it.
    const { data: conn } = await service
      .from("gbp_connections")
      .select("id")
      .eq("google_account_name", "accounts/sample-team")
      .maybeSingle();
    if (conn) {
      const { count } = await service
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("connection_id", conn.id);
      if (!count) await service.from("gbp_connections").delete().eq("id", conn.id);
    }
  }
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

async function signInAs(page: Page, email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("admin connects the team Google account (sample) in Settings", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto("/settings");
  await expect(page.getByText("Sample data — Google API access pending")).toBeVisible();
  await page.getByRole("link", { name: /Connect team Google account|Reconnect/ }).click();
  await expect(page.getByText("Test mode")).toBeVisible();
  await page.getByRole("link", { name: "Allow (sample)" }).click();
  await expect(page).toHaveURL(/\/settings\?gbp=connected$/);
  await expect(page.getByText("Team Google account connected.")).toBeVisible();
  await expect(page.getByText("GBP Pro team account (sample)")).toBeVisible();
});

test("admin links a team-account profile to a client and sees its numbers", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto(`/clients/${assignedClient}`);
  const select = page.getByLabel("Google profile");
  await expect(select).toBeVisible();
  const firstValue = await select.locator("option:not([disabled])").first().getAttribute("value");
  await select.selectOption(firstValue!);
  await page.getByRole("button", { name: "Link profile" }).click();
  await expect(page.getByText("Google profile linked and synced.")).toBeVisible();
  await expect(page.getByText("Unanswered reviews")).toBeVisible();
  await expect(page.getByText("Profile views")).toBeVisible();

  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Synced just now.")).toBeVisible();
});

test("owner connects their own Google account and it links automatically", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto(`/clients/${otherClient}`);
  await page.getByRole("link", { name: "Connect owner's Google account" }).click();
  await expect(
    page.getByRole("heading", { name: "Connect the owner's Google account" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Allow (sample)" }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${otherClient}\\?gbp=linked$`));
  await expect(page.getByText("Google profile linked and synced.")).toBeVisible();
  await expect(page.getByText("(owner account)")).toBeVisible();
});

test("cancelling the sample consent changes nothing", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto("/api/gbp/connect?mode=agency");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/settings\?gbp=cancelled$/);
});

test("manager can sync their client's profile but not unlink it", async ({ page }) => {
  await signInAs(page, managerEmail);
  await page.goto(`/clients/${assignedClient}`);
  await expect(page.getByText("Unanswered reviews")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Synced just now.")).toBeVisible();
});

test("manager can't connect Google for a client that isn't theirs, or the team account", async ({
  page,
}) => {
  await signInAs(page, managerEmail);
  await page.goto(`/api/gbp/connect?mode=owner&clientId=${otherClient}`);
  await expect(page).toHaveURL(/\/dashboard\?gbp=forbidden$/);
  await expect(page.getByText("You don't have permission to do that.")).toBeVisible();
  await page.goto("/api/gbp/connect?mode=agency");
  await expect(page).toHaveURL(/\/dashboard\?gbp=forbidden$/);
});

test("a forged or replayed return from Google is rejected", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto("/api/gbp/callback?state=forged-state-value&code=sample-team");
  await expect(page).toHaveURL(/\/dashboard\?gbp=expired$/);
});

test("admin unlinks a profile", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto(`/clients/${assignedClient}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByText("Google profile unlinked from this client.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page
      .getByRole("link", { name: new RegExp(`${tag} Assigned Solar`) })
      .getByText("Google not linked"),
  ).toBeVisible();
});

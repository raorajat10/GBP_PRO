/**
 * Owner connect invites against the real Supabase project (sample Google provider):
 * the team creates a private link, the owner opens it without logging in, approves
 * access, and their profile is linked to the client. Local only (npm run test:e2e:db).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const tag = `e2einv-${Date.now().toString(36)}`;
const managerEmail = `${tag}-manager@example.com`;

let service: SupabaseClient;
let userId = "";
const clients: Record<"a" | "b", string> = { a: "", b: "" };

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  const { data, error } = await service.auth.admin.createUser({
    email: managerEmail,
    email_confirm: true,
    app_metadata: { role: "manager" },
  });
  if (error) throw error;
  userId = data.user.id;
  const { data: rows, error: cErr } = await service
    .from("clients")
    .insert([
      { business_name: `${tag} A Batteries`, assigned_manager_id: userId },
      { business_name: `${tag} B Solar`, assigned_manager_id: userId },
    ])
    .select("id, business_name");
  if (cErr) throw cErr;
  clients.a = rows.find((r) => r.business_name.includes(" A "))!.id;
  clients.b = rows.find((r) => r.business_name.includes(" B "))!.id;
});

test.afterAll(async () => {
  if (!service) return;
  const ids = Object.values(clients).filter(Boolean);
  await service.from("locations").delete().in("client_id", ids);
  await service.from("gbp_connections").delete().in("client_id", ids);
  await service.from("clients").delete().in("id", ids);
  if (userId) await service.auth.admin.deleteUser(userId);
});

async function signInAs(page: Page, email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createInviteLink(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}`);
  await expect(page.getByText("ask the owner to approve access from their phone")).toBeVisible();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByText("Invite link created. Send it to the owner.")).toBeVisible();
  const link = await page.getByLabel(/Invite link/).inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("list", { name: "Recent invites" })).toContainText(
    "Waiting for the owner",
  );
  return new URL(link).pathname;
}

async function ownerPage(browser: Browser) {
  const ctx = await browser.newContext();
  return { page: await ctx.newPage(), close: () => ctx.close() };
}

test("owner approves access from the invite link; the profile links to the client", async ({
  page,
  browser,
}) => {
  await signInAs(page, managerEmail);
  const path = await createInviteLink(page, clients.a);

  const owner = await ownerPage(browser);
  await owner.page.goto(path);
  await expect(
    owner.page.getByRole("heading", { name: `Connect ${tag} A Batteries's Google profile` }),
  ).toBeVisible();
  await expect(owner.page.getByText("Post anything without your approval")).toBeVisible();

  // First the owner cancels on the consent screen: nothing changes and the link still works.
  await owner.page.getByRole("link", { name: "Continue with Google" }).click();
  await owner.page.getByRole("link", { name: "Cancel" }).click();
  await expect(owner.page.getByRole("heading", { name: "Not connected" })).toBeVisible();

  await owner.page.goto(path);
  await owner.page.getByRole("link", { name: "Continue with Google" }).click();
  await expect(owner.page.getByText("Test mode")).toBeVisible();
  await owner.page.getByRole("link", { name: "Allow (sample)" }).click();
  await expect(owner.page.getByRole("heading", { name: "Connected ✅" })).toBeVisible();

  // Single use.
  await owner.page.goto(path);
  await expect(owner.page.getByRole("heading", { name: "Already connected ✅" })).toBeVisible();
  await owner.close();

  // The team sees the linked profile (with its first audit).
  await page.reload();
  await expect(page.getByText("(owner account)")).toBeVisible();
  await expect(page.getByRole("region", { name: "Profile audit" })).toBeVisible();
  const { data: conn } = await service
    .from("gbp_connections")
    .select("mode, connected_by")
    .eq("client_id", clients.a)
    .single();
  expect(conn).toEqual({ mode: "owner_oauth", connected_by: null });
});

test("a cancelled invite stops working", async ({ page, browser }) => {
  await signInAs(page, managerEmail);
  const path = await createInviteLink(page, clients.b);
  await page
    .getByRole("list", { name: "Recent invites" })
    .getByRole("button", { name: "Cancel" })
    .first()
    .click();
  await expect(page.getByRole("list", { name: "Recent invites" })).toContainText("Cancelled");

  const owner = await ownerPage(browser);
  await owner.page.goto(path);
  await expect(owner.page.getByRole("heading", { name: "This link was withdrawn" })).toBeVisible();
  await expect(owner.page.getByRole("link", { name: "Continue with Google" })).toHaveCount(0);
  // Going straight to the start URL is refused too.
  await owner.page.goto(`/api/gbp/invite?token=${path.split("/").pop()}`);
  await expect(owner.page.getByRole("heading", { name: "This link was withdrawn" })).toBeVisible();
  await owner.close();
});

test("made-up invite links and forged callbacks do nothing", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.page.goto(`/invite/${"A".repeat(43)}`);
  await expect(owner.page.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
  // A callback without the cookie from a real invite start is treated as a team callback,
  // which needs a login.
  await owner.page.goto("/api/gbp/callback?state=forged&code=sample-owner");
  await expect(owner.page).toHaveURL(/\/login/);
  await owner.close();
});

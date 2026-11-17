/**
 * M3 acceptance against the real Supabase project: an admin adds 5 clients through the UI
 * and sees them listed; a manager sees only theirs and can't reassign.
 * Local only (npm run test:e2e:db). Creates tagged throwaway data and deletes it afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env — skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const tag = `e2etest-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;
const managerEmail = `${tag}-manager@example.com`;
const ownerEmail = `${tag}-owner@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  for (const [email, role, name] of [
    [adminEmail, "admin", "Test Admin"],
    [managerEmail, "manager", "Test Manager"],
  ] as const) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: `${tag} ${name}` },
    });
    if (error) throw error;
    userIds.push(data.user.id);
  }
});

test.afterAll(async () => {
  if (!service) return;
  await service.from("clients").delete().like("business_name", `${tag}%`);
  const { data: owner } = await service
    .from("profiles")
    .select("id")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (owner) userIds.push(owner.id);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

/** Sign in without email: get a one-time token from the admin API and use the callback route. */
async function signInAs(page: Page, email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

const clients = [
  { name: "A Batteries", industry: "battery", phone: "98290 12345", consent: true },
  { name: "B Solar", industry: "solar", phone: "", consent: false },
  { name: "C Clinic", industry: "clinic", phone: "09876543210", consent: true },
  { name: "D Kirana", industry: "retail", phone: "", consent: false },
  { name: "E Inverters", industry: "battery", phone: "+91 91234 56789", consent: false },
];

test("admin adds 5 clients and sees them listed", async ({ page }) => {
  await signInAs(page, adminEmail);

  for (const c of clients) {
    await page.goto("/clients/new");
    await page.getByLabel("Business name").fill(`${tag} ${c.name}`);
    await page.getByLabel("Type of business").selectOption(c.industry);
    if (c.name.startsWith("A")) {
      await page.getByLabel("Account manager").selectOption({ label: `${tag} Test Manager` });
    }
    if (c.phone) await page.getByLabel("WhatsApp number").fill(c.phone);
    if (c.consent) await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${tag} ${c.name}`);
  }

  await page.goto("/dashboard");
  for (const c of clients) {
    await expect(page.getByRole("link", { name: new RegExp(`${tag} ${c.name}`) })).toBeVisible();
  }

  // Phone numbers were normalised to +91…
  const { data } = await service
    .from("clients")
    .select("business_name, owner_whatsapp, whatsapp_opt_in_at")
    .like("business_name", `${tag}%`)
    .order("business_name");
  expect(data!.map((r) => r.owner_whatsapp)).toEqual([
    "+919829012345",
    null,
    "+919876543210",
    null,
    "+919123456789",
  ]);
  expect(data!.filter((r) => r.whatsapp_opt_in_at)).toHaveLength(2);
});

test("form shows helpful errors and saves nothing when input is wrong", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto("/clients/new");
  await page.getByLabel("Business name").fill(`${tag} Bad Phone`);
  await page.getByLabel("WhatsApp number").fill("12345");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Enter a valid mobile number")).toBeVisible();
  await expect(page).toHaveURL(/\/clients\/new$/);
});

test("admin gives an owner a login", async ({ page }) => {
  await signInAs(page, adminEmail);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: new RegExp(`${tag} C Clinic`) }).click();
  await page.getByLabel("Owner name", { exact: true }).last().fill("Dr Sharma");
  await page.getByLabel("Owner email").fill(ownerEmail);
  await page.getByRole("button", { name: "Give owner a login" }).click();
  await expect(page.getByText(`Dr Sharma can now sign in`)).toBeVisible();
  await expect(page.getByText(ownerEmail).first()).toBeVisible();
});

test("manager sees only their client and can't reassign it", async ({ page }) => {
  await signInAs(page, managerEmail);
  await expect(page.getByRole("heading", { name: "My clients" })).toBeVisible();
  const links = page.getByRole("link", { name: new RegExp(tag) });
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText("A Batteries");

  await links.first().click();
  await expect(page.getByLabel("Account manager")).toBeDisabled();
  await expect(page.getByText("Owner logins")).toHaveCount(0); // admin-only section

  await page.getByLabel("Tone, selling points, things to avoid").fill("Mention 2-year warranty");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("manager can't open someone else's client by URL", async ({ page }) => {
  const { data } = await service
    .from("clients")
    .select("id")
    .eq("business_name", `${tag} B Solar`)
    .single();
  await signInAs(page, managerEmail);
  const res = await page.goto(`/clients/${data!.id}`);
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByText(`${tag} B Solar`)).toHaveCount(0);
  expect(res?.status()).toBeLessThan(500);
});

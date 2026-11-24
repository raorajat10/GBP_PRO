/**
 * Editing the live Google profile (sample provider): the owner edits hours and description,
 * the team edits the phone and adds an owner's photo to Google. Real Supabase; tagged
 * throwaway data, deleted afterwards. Local only.
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
const tag = `e2eedit-${Date.now().toString(36)}`;
const adminEmail = `${tag}-admin@example.com`;
const ownerEmail = `${tag}-owner@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];
let clientId = "";
let locationId = "";

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
    .insert({ business_name: `${tag} Bright Solar` })
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
    const { data: files } = await service.storage.from("media").list(clientId);
    if (files?.length) {
      await service.storage.from("media").remove(files.map((f) => `${clientId}/${f.name}`));
    }
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

async function storedProfile() {
  const { data } = await service
    .from("locations")
    .select("snapshot, phone")
    .eq("id", locationId)
    .single();
  return {
    profile: (data!.snapshot as { profile: Record<string, unknown> }).profile,
    phone: data!.phone,
  };
}

test("owner edits opening hours and description; Google and our copy update", async ({ page }) => {
  await signIn(page, ownerEmail, /\/home$/);
  await page.goto("/home/listing");
  await page
    .getByRole("region", { name: "Opening hours" })
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit business info" })).toBeVisible();

  await page
    .getByLabel("Business description")
    .fill(`${tag} Rooftop solar for homes and factories.`);
  await page.getByLabel("Sunday hours").selectOption("24h");
  await page.getByLabel("Monday hours").selectOption("hours");
  await page.getByLabel("Monday opens").fill("08:30");
  await page.getByLabel("Monday closes").fill("20:00");
  await page.getByRole("button", { name: "Save to Google" }).click();
  await expect(page.getByText(/Saved to Google: description, opening hours\./)).toBeVisible();

  const { profile } = await storedProfile();
  expect(profile.description).toBe(`${tag} Rooftop solar for homes and factories.`);
  expect(profile.regularHours).toEqual(
    expect.arrayContaining([
      { day: "MONDAY", open: "08:30", close: "20:00" },
      { day: "SUNDAY", open: "00:00", close: "24:00" },
    ]),
  );
});

test("a bad phone number is explained, not sent", async ({ page }) => {
  await signIn(page, ownerEmail, /\/home$/);
  await page.goto("/home/listing/edit");
  await page.getByLabel("Phone").fill("12345");
  await page.getByRole("button", { name: "Save to Google" }).click();
  await expect(page.getByText("Enter a 10-digit Indian phone number.")).toBeVisible();
});

test("team changes the phone from the client page; the owner is told", async ({ page }) => {
  await signIn(page, adminEmail, /\/dashboard$/);
  await page.goto(`/clients/${clientId}`);
  const section = page.getByRole("region", { name: "Edit Google profile" });
  await section.getByText("Edit Google profile").click();
  await section.getByLabel("Phone").fill("98290 55555");
  await section.getByRole("button", { name: "Save to Google" }).click();
  await expect(
    section.getByText(/Saved to Google: phone\. The owner has been told\./),
  ).toBeVisible();

  const { profile, phone } = await storedProfile();
  expect(profile.phone).toBe("+91 98290 55555");
  expect(phone).toBe("+91 98290 55555");
  const { data: note } = await service
    .from("notifications")
    .select("body")
    .eq("client_id", clientId)
    .eq("title", "We updated your Google profile")
    .maybeSingle();
  expect(note?.body).toBe("Changed: phone.");
});

test("team adds a photo the owner sent to the Google profile", async ({ page }) => {
  const sharp = (await import("sharp")).default;
  const jpg = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 90, g: 140, b: 120 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  await signIn(page, ownerEmail, /\/home$/);
  await page.goto("/home/listing/photos");
  await page
    .getByLabel("Choose a photo")
    .setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: jpg });
  await page.getByRole("button", { name: "Send photo" }).click();
  await expect(page.getByText("Sent to our team.")).toBeVisible();

  await signIn(page, adminEmail, /\/dashboard$/);
  await page.goto(`/clients/${clientId}`);
  const requests = page.getByRole("region", { name: /Owner requests/ });
  await requests.getByLabel("Photo type").selectOption("EXTERIOR");
  await requests.getByRole("button", { name: "Add to Google photos" }).click();
  await expect(requests.getByRole("button", { name: "Add to Google photos" })).toHaveCount(0);

  const { data: item } = await service
    .from("post_bank_items")
    .select("status")
    .eq("client_id", clientId)
    .single();
  expect(item!.status).toBe("used");
});

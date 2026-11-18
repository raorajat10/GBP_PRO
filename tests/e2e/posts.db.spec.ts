/**
 * M6 acceptance against the real Supabase project: photo + note → 3 drafts in the chosen
 * language, under 1,500 characters, with no phone numbers; then edit, schedule and save.
 * Uses Claude if ANTHROPIC_API_KEY is set on the server, otherwise the sample writer.
 * Local only (npm run test:e2e:db). Tagged throwaway data, deleted afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

try {
  process.loadEnvFile(".env.local");
} catch {
  // skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const tag = `e2epost-${Date.now().toString(36)}`;
const managerEmail = `${tag}-manager@example.com`;
const otherEmail = `${tag}-other@example.com`;

let service: SupabaseClient;
const userIds: string[] = [];
let clientId = "";

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  for (const email of [managerEmail, otherEmail]) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: "manager" },
      user_metadata: { full_name: `${tag} manager` },
    });
    if (error) throw error;
    userIds.push(data.user.id);
  }
  const { data, error } = await service
    .from("clients")
    .insert({
      business_name: `${tag} Battery House`,
      assigned_manager_id: userIds[0],
      preferred_language: "hinglish",
      industry: "battery",
    })
    .select("id")
    .single();
  if (error) throw error;
  clientId = data.id;
});

test.afterAll(async () => {
  if (!service) return;
  if (clientId) {
    const { data: media } = await service
      .from("media_assets")
      .select("storage_path")
      .eq("client_id", clientId);
    if (media?.length) await service.storage.from("media").remove(media.map((m) => m.storage_path));
    await service.from("clients").delete().eq("id", clientId);
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

async function testPhoto() {
  const w = 1200;
  const h = 900;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .jpeg()
    .toBuffer();
}

test("photo + note gives 3 drafts; pick, edit, schedule and save", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, managerEmail);
  await page.goto(`/clients/${clientId}`);
  await page.getByRole("link", { name: "Posts →" }).click();
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
  await page.getByRole("link", { name: "New post" }).click();

  await page.getByLabel(/^Photo/).setInputFiles({
    name: "shop.jpg",
    mimeType: "image/jpeg",
    buffer: await testPhoto(),
  });
  await expect(page.getByAltText("Selected photo")).toBeVisible();

  // Phone numbers in the note are refused before any AI call.
  await page.getByLabel("What is this post about?").fill("Offer! Call 98290 12345");
  await page.getByRole("button", { name: "Write 3 drafts" }).click();
  await expect(page.getByText("Leave phone numbers out")).toBeVisible();
  await expect(page.getByAltText("Selected photo")).toBeVisible(); // still selected

  await page
    .getByLabel("What is this post about?")
    .fill("Exide inverter battery offer, 2-year warranty");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("hinglish"); // client's preference
  await page.getByRole("button", { name: "Write 3 drafts" }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/posts/[0-9a-f-]{36}$`), {
    timeout: 90_000,
  });

  // Three drafts, each within the rules.
  const drafts = page
    .getByRole("group", { name: "Pick a draft to start from" })
    .getByRole("button");
  await expect(drafts).toHaveCount(3);
  const { data: saved } = await service
    .from("posts")
    .select("id, ai_drafts, language, media_asset_id")
    .eq("client_id", clientId)
    .single();
  expect(saved!.language).toBe("hinglish");
  expect(saved!.media_asset_id).not.toBeNull();
  const bodies = (saved!.ai_drafts as { body: string }[]).map((d) => d.body);
  expect(bodies).toHaveLength(3);
  for (const b of bodies) {
    expect([...b].length).toBeLessThanOrEqual(1500);
    expect(b).not.toMatch(/(?:\+?\d[\s\-.()]{0,2}){7,}/);
    expect(b).not.toMatch(/[ऀ-ॿ]/); // Hinglish = Roman script
  }

  // Pick the second draft.
  await drafts.nth(1).click();
  const text = page.getByLabel("Post text");
  await expect(text).toHaveValue(bodies[1]);
  // The private photo really loads through its signed link (not just an empty <img>).
  const preview = page.getByRole("img", { name: "Post photo" });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);

  // A phone number in the text is flagged live and refused on save.
  await text.fill(`${bodies[1]} Call 9829012345`);
  await expect(page.getByText("Remove the phone number.").first()).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();

  // Fix it, choose a time, save.
  await text.fill(`${bodies[1]}\n\nEdited by the team.`);
  await page.getByLabel("Button").selectOption("CALL");
  const when = new Date(Date.now() + 3 * 86_400_000 + 330 * 60_000).toISOString().slice(0, 11);
  await page.getByLabel(/Publish on/).fill(`${when}10:30`);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  const { data: after } = await service
    .from("posts")
    .select("body, status, scheduled_for, cta_type")
    .eq("id", saved!.id)
    .single();
  expect(after!.body.endsWith("Edited by the team.")).toBe(true);
  expect(after!.status).toBe("draft");
  expect(after!.cta_type).toBe("CALL");
  expect(new Date(after!.scheduled_for!).toISOString()).toBe(
    new Date(`${when}10:30:00+05:30`).toISOString(),
  );

  // The list shows it.
  await page.getByRole("link", { name: "← Posts" }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/posts$`));
  await expect(page.getByRole("listitem").filter({ hasText: "Edited by the team." })).toBeVisible();
});

test("another manager can't open this client's posts", async ({ page }) => {
  await signInAs(page, otherEmail);
  await page.goto(`/clients/${clientId}/posts`);
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByText(`${tag} Battery House`)).toHaveCount(0);
});

test("deleting a draft removes it and its photo", async ({ page }) => {
  await signInAs(page, managerEmail);
  const { data: p } = await service
    .from("posts")
    .select("id, media:media_assets(storage_path)")
    .eq("client_id", clientId)
    .single();
  await page.goto(`/clients/${clientId}/posts/${p!.id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/posts$`));
  await expect(page.getByText("No posts yet.")).toBeVisible();

  const { count } = await service
    .from("media_assets")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  expect(count).toBe(0);
  const storagePath = (p!.media as unknown as { storage_path: string }).storage_path;
  const folder = storagePath.split("/")[0];
  const { data: files } = await service.storage.from("media").list(folder);
  expect(files ?? []).toEqual([]);
});

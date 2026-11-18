/**
 * M7 acceptance in the browser, against the real Supabase project: the manager sends a
 * post for approval, the owner answers on the no-login link page, the manager sees it.
 * Local only (npm run test:e2e:db). Tagged throwaway data, deleted afterwards.
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
const tag = `e2eappr-${Date.now().toString(36)}`;
const managerEmail = `${tag}-manager@example.com`;

let service: SupabaseClient;
let userId = "";
let clientId = "";

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
  // No WhatsApp consent: the approval goes out as a link the manager shares.
  const { data: c, error: cErr } = await service
    .from("clients")
    .insert({ business_name: `${tag} Solar`, owner_name: "Sunita", assigned_manager_id: userId })
    .select("id")
    .single();
  if (cErr) throw cErr;
  clientId = c.id;
});

test.afterAll(async () => {
  if (!service) return;
  if (clientId) await service.from("clients").delete().eq("id", clientId);
  if (userId) await service.auth.admin.deleteUser(userId);
});

async function signInAs(page: Page, email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function newDraft(body: string) {
  const { data, error } = await service
    .from("posts")
    .insert({ client_id: clientId, language: "en", body, source_note: `${tag} note` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Manager sends the post and copies the one-time link. */
async function sendAndGetLink(page: Page, postId: string) {
  await page.goto(`/clients/${clientId}/posts/${postId}`);
  const panel = page.getByRole("region", { name: "Owner approval" });
  await expect(panel.getByText("hasn't agreed to WhatsApp messages")).toBeVisible();
  await panel.getByRole("button", { name: /Send for approval|Send again/ }).click();
  await expect(panel.getByText("Approval link created. Send it to the owner.")).toBeVisible();
  const link = await panel.getByLabel(/Approval link/).inputValue();
  expect(link).toMatch(/\/approve\/[A-Za-z0-9_-]{43}$/);
  await panel.getByRole("button", { name: "Done" }).click();
  await expect(panel.getByText(/Waiting for Sunita/)).toBeVisible();
  return link;
}

/** The owner opens the link in a fresh browser with no login. */
async function asOwner(browser: Browser, link: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(new URL(link).pathname);
  return { page, close: () => ctx.close() };
}

test("owner approves on the link page; the post becomes scheduled and locked", async ({
  page,
  browser,
}) => {
  await signInAs(page, managerEmail);
  const postId = await newDraft(`${tag} Rooftop solar site surveys this week. Book yours today!`);
  const link = await sendAndGetLink(page, postId);

  const owner = await asOwner(browser, link);
  await expect(
    owner.page.getByRole("heading", { name: `New Google post for ${tag} Solar` }),
  ).toBeVisible();
  await expect(owner.page.getByText("Rooftop solar site surveys this week.")).toBeVisible();
  await owner.page.getByRole("button", { name: "Approve ✅" }).click();
  await expect(owner.page.getByRole("heading", { name: "Approved ✅" })).toBeVisible();
  // The link is single-use: reloading shows the result, not the buttons.
  await owner.page.reload();
  await expect(owner.page.getByRole("button", { name: "Approve ✅" })).toHaveCount(0);
  await owner.close();

  await page.reload();
  await expect(page.getByText("Scheduled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Approved by Sunita via the link/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  const { data } = await service.from("posts").select("status").eq("id", postId).single();
  expect(data!.status).toBe("scheduled");
});

test("owner requests a change with a note; the manager sees it and can resend", async ({
  page,
  browser,
}) => {
  await signInAs(page, managerEmail);
  const postId = await newDraft(`${tag} Solar panel cleaning service now available.`);
  const link = await sendAndGetLink(page, postId);

  const owner = await asOwner(browser, link);
  await owner.page.getByRole("button", { name: "Request change ✏️" }).click();
  await owner.page.getByRole("button", { name: "Send to our team" }).click();
  await expect(owner.page.getByText("Tell us what to change")).toBeVisible();
  await owner.page.getByLabel("What should we change?").fill("Mention the monsoon discount too");
  await owner.page.getByRole("button", { name: "Send to our team" }).click();
  await expect(owner.page.getByRole("heading", { name: "Change requested ✏️" })).toBeVisible();
  await owner.close();

  await page.reload();
  const panel = page.getByRole("region", { name: "Owner approval" });
  await expect(panel.getByText("Sunita asked for changes")).toBeVisible();
  await expect(panel.getByText("Mention the monsoon discount too")).toBeVisible();

  // The manager edits and sends again; the old link stops working.
  await page.getByLabel("Post text").fill(`${tag} Solar panel cleaning, now with a monsoon offer.`);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const second = await sendAndGetLink(page, postId);
  expect(second).not.toBe(link);

  const oldOwner = await asOwner(browser, link);
  await expect(oldOwner.page.getByRole("heading", { name: "Change requested ✏️" })).toBeVisible();
  await expect(oldOwner.page.getByRole("button", { name: "Approve ✅" })).toHaveCount(0);
  await oldOwner.close();
});

test("manager can cancel a request; the link then shows it was withdrawn", async ({
  page,
  browser,
}) => {
  await signInAs(page, managerEmail);
  const postId = await newDraft(`${tag} Free site visit across Jaipur.`);
  const link = await sendAndGetLink(page, postId);
  const panel = page.getByRole("region", { name: "Owner approval" });
  page.once("dialog", (d) => d.accept());
  await panel.getByRole("button", { name: "Cancel request" }).click();
  // The page refreshes straight back to a draft that can be sent again.
  await expect(panel.getByRole("button", { name: "Send for approval" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  const { data } = await service.from("posts").select("status").eq("id", postId).single();
  expect(data!.status).toBe("draft");

  const owner = await asOwner(browser, link);
  await expect(
    owner.page.getByRole("heading", { name: "This request was withdrawn" }),
  ).toBeVisible();
  await owner.close();
});

test("a made-up link shows a friendly error", async ({ browser }) => {
  const owner = await asOwner(browser, `http://x/approve/${"A".repeat(43)}`);
  await expect(owner.page.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
  await owner.close();
});

test("the cron endpoint refuses callers without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/approvals")).status()).toBe(401);
  const wrong = await request.get("/api/cron/approvals", {
    headers: { Authorization: "Bearer wrong-secret-wrong-secret" },
  });
  expect(wrong.status()).toBe(401);
});

test("the WhatsApp webhook rejects unsigned or unconfigured calls", async ({ request }) => {
  const res = await request.post("/api/webhooks/whatsapp", { data: { entry: [] } });
  expect([401, 503]).toContain(res.status());
  const verify = await request.get(
    "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=123",
  );
  expect(verify.status()).toBe(403);
});

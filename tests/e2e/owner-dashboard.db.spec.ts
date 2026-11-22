/**
 * Owner dashboard (/home) against the real Supabase project. Data is written directly with
 * the secret key (sample connection, snapshot, two audits, posts), tagged and deleted after.
 * Local only (npm run test:e2e:db).
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
const tag = `e2eown-${Date.now().toString(36)}`;
const ownerEmail = `${tag}-owner@example.com`;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

let service: SupabaseClient;
let ownerId = "";
const clientIds: string[] = [];

test.describe.configure({ mode: "serial" });
test.skip(!url || !secretKey || !!process.env.CI, "Needs .env.local; runs locally only");

test.beforeAll(async () => {
  service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  const { data: user, error: userErr } = await service.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
    app_metadata: { role: "client" },
    user_metadata: { full_name: `${tag} Owner` },
  });
  if (userErr) throw userErr;
  ownerId = user.user.id;

  const { data: clients, error } = await service
    .from("clients")
    .insert([
      { business_name: `${tag} Alpha Solar` },
      { business_name: `${tag} Beta Batteries` },
      { business_name: `${tag} Not Mine` },
    ])
    .select("id, business_name");
  if (error) throw error;
  clientIds.push(...clients.map((c) => c.id));
  const [alpha, beta] = clients;
  const ins = await service.from("client_users").insert([
    { client_id: alpha.id, user_id: ownerId },
    { client_id: beta.id, user_id: ownerId },
  ]);
  if (ins.error) throw ins.error;

  const { data: conn, error: connErr } = await service
    .from("gbp_connections")
    .insert({
      provider: "mock",
      mode: "owner_oauth",
      client_id: alpha.id,
      google_account_name: `accounts/${tag}`,
      google_account_label: "sample",
    })
    .select("id")
    .single();
  if (connErr) throw connErr;

  const snapshot = {
    version: 1,
    profile: { name: `locations/${tag}`, title: "Alpha Solar" },
    photos: { total: 4, last30Days: 0, hasLogo: true, hasCover: false, latest: daysAgo(60) },
    posts: { total: 1, last7Days: 0, last30Days: 0, latest: daysAgo(40) },
    reviews: {
      total: 37,
      average: 4.6,
      unanswered: 2,
      last90Days: 6,
      repliedLast90Days: 4,
      replyRateLast90Days: 4 / 6,
      medianReplyHoursLast90Days: 12,
      latest: daysAgo(2),
      recent: [
        {
          reviewer: "Asha Verma",
          starRating: 5,
          comment: "Panels installed in two days, very neat work.",
          createTime: daysAgo(2),
          replied: false,
        },
        {
          reviewer: "Imran K",
          starRating: 4,
          comment: null,
          createTime: daysAgo(9),
          replied: true,
        },
      ],
    },
    metrics: {
      days: 28,
      from: daysAgo(28).slice(0, 10),
      to: daysAgo(1).slice(0, 10),
      impressions: 1234,
      calls: 17,
      directionRequests: 9,
      websiteClicks: 21,
    },
    syncedAt: daysAgo(1),
  };
  const { data: loc, error: locErr } = await service
    .from("locations")
    .insert({
      client_id: alpha.id,
      connection_id: conn.id,
      gbp_account_name: `accounts/${tag}`,
      gbp_location_name: `locations/${tag}`,
      title: "Alpha Solar",
      snapshot,
    })
    .select("id")
    .single();
  if (locErr) throw locErr;

  // Two audits: 76 then 74, so the dashboard shows "Down 2 pts".
  for (const [score, minutesAgo] of [
    [76, 60],
    [74, 1],
  ] as const) {
    const { data: audit, error: aErr } = await service
      .from("audits")
      .insert({
        location_id: loc.id,
        client_id: alpha.id,
        score,
        snapshot_synced_at: snapshot.syncedAt,
        created_at: new Date(now - minutesAgo * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (aErr) throw aErr;
    const items = await service.from("audit_items").insert([
      {
        audit_id: audit.id,
        check_key: "reviews",
        status: "fail",
        points: 5,
        points_max: 12,
        rank: 1,
        title: "Number of reviews and rating",
        facts: "-",
      },
      {
        audit_id: audit.id,
        check_key: "description",
        status: "warn",
        points: 4,
        points_max: 10,
        rank: 2,
        title: "Business description",
        facts: "-",
      },
      {
        audit_id: audit.id,
        check_key: "photos",
        status: "warn",
        points: 6,
        points_max: 8,
        rank: 3,
        title: "Photos",
        facts: "-",
      },
      {
        audit_id: audit.id,
        check_key: "contact",
        status: "pass",
        points: 8,
        points_max: 8,
        rank: 4,
        title: "Phone and website",
        facts: "-",
      },
    ]);
    if (items.error) throw items.error;
  }

  const posts = await service.from("posts").insert([
    {
      client_id: alpha.id,
      status: "pending_approval",
      language: "en",
      body: `${tag} Diwali offer on rooftop solar`,
      source_note: "test",
    },
    {
      client_id: alpha.id,
      status: "draft",
      language: "en",
      body: `${tag} secret draft`,
      source_note: "test",
    },
  ]);
  if (posts.error) throw posts.error;
});

test.afterAll(async () => {
  if (!service) return;
  await service.from("posts").delete().in("client_id", clientIds);
  await service.from("locations").delete().in("client_id", clientIds);
  await service.from("gbp_connections").delete().in("client_id", clientIds);
  await service.from("clients").delete().in("id", clientIds);
  if (ownerId) await service.auth.admin.deleteUser(ownerId);
});

async function signInAsOwner(page: Page) {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
  });
  if (error) throw error;
  await page.context().clearCookies();
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}`);
  await expect(page).toHaveURL(/\/home$/);
}

test("owner sees score, trend, breakdown, focus, numbers, reviews and posts", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByRole("heading", { name: `Namaste, ${tag} Owner` })).toBeVisible();

  const overview = page.getByRole("region", { name: "Overview" });
  await expect(overview.getByText("Profile score 74 out of 100, Fair")).toBeAttached();
  await expect(overview.getByText("Down 2 pts since last check")).toBeVisible();
  await expect(overview.getByText("4.6 ★")).toBeVisible();
  await expect(overview.getByText("1,234")).toBeVisible();
  await expect(overview.getByText("Last 28 days on Google")).toBeVisible();

  const breakdown = page.getByRole("region", { name: "Score breakdown" });
  await expect(breakdown.getByRole("meter", { name: "Business description" })).toHaveAttribute(
    "aria-valuenow",
    "4",
  );

  const focus = page.getByRole("region", { name: "Your focus" });
  await expect(focus.getByText("Approve the post waiting for you")).toBeVisible();
  await expect(focus.getByText("Ask one happy customer for a Google review")).toBeVisible();
  await expect(focus.getByText("Send us 3–5 new photos of your work")).toBeVisible();
  await expect(focus.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\?text=.*%2Freview%2F/,
  );
  // Team-only work is listed, owner checks are not repeated there.
  await expect(focus.getByText("Business description")).toBeVisible();

  const reviews = page.getByRole("region", { name: "Recent reviews" });
  await expect(reviews.getByText("Asha Verma")).toBeVisible();
  await expect(reviews.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
  await expect(reviews.getByText("Reply on the way")).toBeVisible();
  await expect(reviews.getByText("Replied", { exact: true })).toBeVisible();

  const posts = page.getByRole("region", { name: "Posts" });
  await expect(posts.getByText(`${tag} Diwali offer on rooftop solar`)).toBeVisible();
  await expect(posts.getByText("Waiting for owner")).toBeVisible();
  await expect(page.getByText(`${tag} secret draft`)).toHaveCount(0);
  await expect(page.getByText(`${tag} Not Mine`)).toHaveCount(0);
});

test("fits a phone screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsOwner(page);
  await expect(page.getByRole("region", { name: "Overview" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("owner switches to a business without a linked profile", async ({ page }) => {
  await signInAsOwner(page);
  await page
    .getByRole("navigation", { name: "Your businesses" })
    .getByRole("link", { name: `${tag} Beta Batteries` })
    .click();
  await expect(page).toHaveURL(/\/home\?b=/);
  await expect(
    page.getByText("Your Google profile score will appear here once our team links your profile."),
  ).toBeVisible();
  await expect(page.getByText("Ask one happy customer for a Google review")).toBeVisible();
});

test("theme switch flips and remembers dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAsOwner(page);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
});

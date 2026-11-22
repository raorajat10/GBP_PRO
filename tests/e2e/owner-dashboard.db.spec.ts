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
const adminEmail = `${tag}-admin@example.com`;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

let service: SupabaseClient;
let ownerId = "";
let adminId = "";
let alphaId = "";
let alphaSlug = "";
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
  const { data: admin, error: adminErr } = await service.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: `${tag} Admin` },
  });
  if (adminErr) throw adminErr;
  adminId = admin.user.id;

  const { data: clients, error } = await service
    .from("clients")
    .insert([
      { business_name: `${tag} Alpha Solar` },
      { business_name: `${tag} Beta Batteries` },
      { business_name: `${tag} Not Mine` },
    ])
    .select("id, business_name, slug");
  if (error) throw error;
  clientIds.push(...clients.map((c) => c.id));
  const [alpha, beta] = clients;
  alphaId = alpha.id;
  alphaSlug = alpha.slug;
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
    profile: {
      name: `locations/${tag}`,
      accountName: `accounts/${tag}`,
      title: "Alpha Solar",
      placeId: null,
      verified: true,
      primaryCategory: { id: "gcid:solar_energy_company", displayName: "Solar energy company" },
      additionalCategories: [{ id: "gcid:solar_contractor", displayName: "Solar contractor" }],
      phone: "+91 98290 12345",
      websiteUri: "https://alpha.example.com",
      address: {
        addressLines: ["12 Tonk Road", "Sitapura"],
        locality: "Jaipur",
        administrativeArea: "Rajasthan",
        postalCode: "302022",
        regionCode: "IN",
      },
      description: "Rooftop solar for homes and factories in Jaipur.",
      regularHours: [{ day: "MONDAY", open: "09:30", close: "19:00" }],
      specialHours: [],
      services: ["Rooftop solar installation", "Solar maintenance"],
      attributes: ["accepts_upi"],
      openingDate: null,
    },
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

  // Owner-portal history: reviews, 40 days of metrics, private feedback.
  const seeded = await Promise.all([
    service.from("reviews").insert([
      {
        location_id: loc.id,
        client_id: alpha.id,
        gbp_review_name: `${tag}/r1`,
        reviewer: "Asha Verma",
        star_rating: 5,
        comment: "Panels installed in two days, very neat work.",
        reviewed_at: daysAgo(2),
      },
      {
        location_id: loc.id,
        client_id: alpha.id,
        gbp_review_name: `${tag}/r2`,
        reviewer: "Imran K",
        star_rating: 2,
        comment: "Took three visits to fix the inverter.",
        reviewed_at: daysAgo(9),
        reply_comment: "Sorry Imran, we've changed how we schedule repairs.",
        replied_at: daysAgo(8),
      },
    ]),
    service.from("location_metrics_daily").insert(
      Array.from({ length: 40 }, (_, i) => ({
        location_id: loc.id,
        client_id: alpha.id,
        day: daysAgo(i + 2).slice(0, 10),
        impressions_search: 30,
        impressions_maps: 10,
        calls: 1,
        direction_requests: 1,
        website_clicks: 1,
      })),
    ),
    service.from("review_feedback").insert({
      client_id: alpha.id,
      rating: 2,
      message: `${tag} The installer left a mess on the roof.`,
      contact: "98290 00000",
    }),
  ]);
  for (const r of seeded) if (r.error) throw r.error;

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
  for (const id of clientIds) {
    const { data: files } = await service.storage.from("media").list(id);
    if (files?.length)
      await service.storage.from("media").remove(files.map((f) => `${id}/${f.name}`));
  }
  await service.from("posts").delete().in("client_id", clientIds);
  await service.from("locations").delete().in("client_id", clientIds);
  await service.from("gbp_connections").delete().in("client_id", clientIds);
  await service.from("clients").delete().in("id", clientIds);
  if (ownerId) await service.auth.admin.deleteUser(ownerId);
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

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
    .getByRole("combobox", { name: "Business" })
    .selectOption({ label: `${tag} Beta Batteries` });
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

// ───────────── Owner portal pages ─────────────

const PAGES: [string, string][] = [
  ["/home/listing", "Business info"],
  ["/home/listing/attributes", "Attributes"],
  ["/home/listing/services", "Services"],
  ["/home/listing/photos", "Photos"],
  ["/home/reviews", "Google reviews"],
  ["/home/reviews/feedback", "Private feedback"],
  ["/home/insights/score", "Profile score"],
  ["/home/insights/analytics", "Analytics"],
  ["/home/insights/grid", "Grid ranking"],
  ["/home/insights/competitors", "Competitors"],
  ["/home/insights/reports", "Monthly reports"],
  ["/home/grow/posts", "Posts"],
  ["/home/grow/post-bank", "Post bank"],
  ["/home/grow/qr", "QR code & review poster"],
  ["/home/grow/card", "Digital card"],
  ["/home/notifications", "Notifications"],
  ["/home/support", "Help & support"],
  ["/home/settings", "Settings"],
];

test("every menu link opens its page", async ({ page }) => {
  await signInAsOwner(page);
  const menu = page.getByRole("navigation", { name: "Owner menu" });
  for (const [href, title] of PAGES) {
    await menu.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, "\\/")}$`));
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(menu.locator(`a[href="${href}"]`)).toHaveAttribute("aria-current", "page");
  }
});

test("business info shows the profile and sends a change request", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/listing");
  await expect(
    page.getByText("12 Tonk Road, Sitapura, Jaipur, Rajasthan, 302022").first(),
  ).toBeVisible();
  await expect(page.getByText("Solar contractor")).toBeVisible();
  const basic = page.getByRole("region", { name: "Basic information" });
  await basic.getByRole("button", { name: "Ask for a change" }).click();
  await basic.getByLabel("Your request").fill(`${tag} New phone number is 98290 99999`);
  await basic.getByRole("button", { name: "Send to our team" }).click();
  await expect(basic.getByText("Sent to our team.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your requests" }).getByText(`${tag} New phone number`),
  ).toBeVisible();
});

test("attributes: flipping a switch asks for only that change", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/listing/attributes");
  const upi = page.getByRole("switch", { name: "UPI (GPay, PhonePe, Paytm)" });
  await expect(upi).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Free parking" }).click();
  await page.getByRole("button", { name: "Ask our team to update Google" }).click();
  await expect(page.getByText("Sent to our team.", { exact: false })).toBeVisible();
  const { data } = await service
    .from("change_requests")
    .select("message")
    .eq("client_id", alphaId)
    .eq("area", "attributes")
    .single();
  expect(data?.message).toBe("Turn on: Free parking");
});

test("reviews: summary, filters and replies", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/reviews");
  await expect(page.getByText("3.5", { exact: true })).toBeVisible();
  await expect(page.getByText("Sorry Imran, we've changed how we schedule repairs.")).toBeVisible();
  await page.getByRole("link", { name: "Needs a reply" }).click();
  await expect(page).toHaveURL(/reply=unreplied/);
  await expect(page.getByText("Asha Verma")).toBeVisible();
  await expect(page.getByText("Imran K")).toHaveCount(0);
});

test("private feedback can be marked resolved", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/reviews/feedback");
  const item = page.getByRole("listitem").filter({ hasText: `${tag} The installer left a mess` });
  await expect(item.getByText("98290 00000")).toBeVisible();
  await item.getByRole("button", { name: "Mark resolved" }).click();
  await expect(item.getByText("Resolved", { exact: true })).toBeVisible();
});

test("analytics totals follow the chosen range", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/insights/analytics");
  const totals = page.getByRole("region", { name: "Totals" });
  await expect(totals.getByText("1,200", { exact: true })).toBeVisible(); // 30 days × 40 views
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(totals.getByText("280", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Daily profile views/ })).toBeVisible();
});

test("score page and monthly report", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/insights/score");
  await expect(page.getByRole("region", { name: "What will raise your score" })).toContainText(
    "Business description",
  );
  await page.getByRole("button", { name: "Recalculate" }).click();
  await expect(page.getByText("Your score is already up to date.")).toBeVisible();

  await page.goto("/home/insights/reports");
  await page.getByRole("link", { name: /So far this month/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: / report$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});

test("post bank: upload a photo, see it, remove it", async ({ page }) => {
  const sharp = (await import("sharp")).default;
  const jpg = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 120, g: 160, b: 140 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  await signInAsOwner(page);
  await page.goto("/home/grow/post-bank");
  await page
    .getByLabel("Choose a photo")
    .setInputFiles({ name: "job.jpg", mimeType: "image/jpeg", buffer: jpg });
  await expect(page.getByAltText("Chosen photo")).toBeVisible();
  await page.getByLabel("Note for our team (optional)").fill(`${tag} 5 kW job in Bagru`);
  await page.getByRole("button", { name: "Add to post bank" }).click();
  await expect(page.getByText("Sent to our team.")).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: `${tag} 5 kW job in Bagru` });
  await expect(item.getByText("With our team")).toBeVisible();
  await item.getByRole("button", { name: "Remove" }).click();
  await expect(item).toHaveCount(0);
});

test("QR poster and public digital card", async ({ page, request }) => {
  await signInAsOwner(page);
  await page.goto("/home/grow/qr");
  await expect(page.getByText(new RegExp(`/review/${alphaSlug}$`))).toBeVisible();
  await expect(page.getByLabel("Poster preview")).toBeVisible();

  await page.goto(`/card/${alphaSlug}`);
  await expect(page.getByRole("heading", { name: "Alpha Solar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  const res = await request.get(`/card/${alphaSlug}/go?to=directions`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
  const bad = await request.get(`/card/${alphaSlug}/go?to=https://evil.example`, {
    maxRedirects: 0,
  });
  expect(bad.headers().location).toMatch(new RegExp(`/card/${alphaSlug}$`));

  await page.goto("/home/grow/card");
  const stats = page.getByRole("region", { name: "Last 30 days" });
  await expect(stats.getByText("Directions", { exact: true }).locator("..")).toContainText("1");
});

test("support ticket: owner asks, team replies, owner is notified", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/support");
  await page.getByLabel("Subject").fill(`${tag} Wrong phone on Google`);
  await page.getByLabel("About").selectOption("google_profile");
  await page.getByLabel("What do you need?").fill("Please change the phone number to 98290 99999.");
  await page.getByRole("button", { name: "Send to our team" }).click();
  await expect(page.getByText("Sent. Our team usually replies", { exact: false })).toBeVisible();

  await signInAsAdmin(page);
  await page.goto(`/clients/${alphaId}`);
  const requests = page.getByRole("region", { name: /Owner requests/ });
  await expect(requests.getByText(`${tag} New phone number is 98290 99999`)).toBeVisible();
  const ticket = requests.getByRole("listitem").filter({ hasText: `${tag} Wrong phone on Google` });
  await ticket.getByLabel("Reply to owner").fill("Done, Google shows the new number now.");
  await ticket.getByRole("button", { name: "Reply and resolve" }).click();
  await expect(ticket).toHaveCount(0);

  await signInAsOwner(page);
  await expect(page.getByRole("link", { name: /Notifications, \d+ unread/ })).toBeVisible();
  await page.goto("/home/notifications");
  await page
    .getByRole("button", { name: new RegExp(`Our team replied: ${tag} Wrong phone`) })
    .click();
  await expect(page).toHaveURL(/\/home\/support/);
  await expect(
    page
      .getByRole("region", { name: "Your requests" })
      .getByText("Done, Google shows the new number now."),
  ).toBeVisible();
});

test("grid ranking: track a keyword, scan it, see competitors", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/insights/grid");
  const add = page.getByRole("region", { name: "Track a keyword" });
  await add.getByLabel("Keyword", { exact: true }).fill("Solar Company In Jaipur");
  await add.getByLabel("Grid", { exact: true }).selectOption("3");
  await add.getByLabel("Distance from you").selectOption("2");
  await add.getByRole("button", { name: "Track keyword" }).click();
  await expect(page.getByRole("heading", { name: "“solar company in jaipur”" })).toBeVisible();
  await expect(page.getByText("Uses 9 of your 250 grid points left this month.")).toBeVisible();

  await page.getByRole("button", { name: "Scan now" }).click();
  await expect(page).toHaveURL(/scan=/);
  const grid = page.getByRole("grid", { name: /Your Google position/ });
  await expect(grid.getByRole("gridcell")).toHaveCount(9);
  await expect(page.getByText("Sample data")).toBeVisible();
  await expect(page.getByRole("region", { name: "Scan results" })).toContainText("Visibility");
  await expect(page.getByText("9 / 250")).toBeVisible();
  // Picking a corner shows who ranks there.
  await grid.getByRole("gridcell", { name: /^north-west:/ }).click();
  await expect(page.getByText(/^Searching from north-west/)).toBeVisible();

  await page.goto("/home/insights/competitors");
  const table = page.getByRole("region", { name: "Who you're up against" });
  await expect(table.getByRole("row")).not.toHaveCount(1);
  await expect(table.getByRole("cell", { name: "You", exact: true })).toBeVisible();

  await page.goto("/home");
  await expect(page.getByRole("region", { name: "Top competitors" })).toContainText("(you)");

  await page.goto("/home/insights/grid");
  await page.getByRole("button", { name: "Stop tracking" }).click();
  await expect(page.getByRole("heading", { name: "Track a keyword" })).toBeVisible();
});

test("settings: owner renames themselves", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/home/settings");
  await page.getByLabel("Your name").fill(`${tag} Owner Ji`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: `Namaste, ${tag} Owner Ji` })).toBeVisible();
});

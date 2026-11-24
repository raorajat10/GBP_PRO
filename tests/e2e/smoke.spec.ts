import { expect, test } from "@playwright/test";

test("home page explains the service and how Google data is used", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GBP Pro");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GBP Pro");
  await expect(page.getByRole("heading", { name: "How we use your Google data" })).toBeVisible();
  await expect(page.getByText("Sarvatra Energy Private Limited").first()).toBeVisible();
});

test("privacy policy and terms are public and linked from every public page", async ({ page }) => {
  for (const start of ["/", "/login"]) {
    await page.goto(start);
    const legal = page.getByRole("navigation", { name: "Legal" });
    await expect(legal.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await expect(legal.getByRole("link", { name: "Terms of service" })).toHaveAttribute(
      "href",
      "/terms",
    );
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  // Google requires this exact commitment for apps that use its APIs.
  await expect(page.getByText(/including the Limited Use requirements/)).toBeVisible();
  await expect(page.getByRole("link", { name: "yadupatirajat@gmail.com" }).first()).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await expect(page.getByText(/No post is published without your approval/)).toBeVisible();
});

test("health endpoint is up and runs on mock providers", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({
    status: "ok",
    app: "GBP Pro",
    providers: { gbp: "mock", messaging: "mock" },
  });
});

test("scheduled jobs refuse callers without the secret", async ({ request }) => {
  for (const job of ["approvals", "publish", "sync"]) {
    expect((await request.get(`/api/cron/${job}`)).status(), job).toBe(401);
    const wrong = await request.get(`/api/cron/${job}`, {
      headers: { authorization: "Bearer not-the-secret" },
    });
    expect(wrong.status(), job).toBe(401);
  }
});

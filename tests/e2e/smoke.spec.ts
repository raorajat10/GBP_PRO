import { expect, test } from "@playwright/test";

test("home page shows the brand and build progress", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GBP Pro");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GBP Pro");
  await expect(page.getByRole("heading", { name: "Build progress" })).toBeVisible();
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

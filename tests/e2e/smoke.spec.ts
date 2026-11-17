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

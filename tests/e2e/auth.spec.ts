import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to login, keeping where they were going", async ({ page }) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login\?next=%2Fteam$/);
  await expect(page.getByRole("heading", { name: /Sign in to GBP Pro/ })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
});

test("public pages stay public", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
});

import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to login, keeping where they were going", async ({ page }) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login\?next=%2Fteam$/);
  await expect(page.getByRole("heading", { name: /Sign in to GBP Pro/ })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
});

test("a sign-in code that lands on the home page is forwarded, not dropped", async ({ page }) => {
  // The code is fake, so the handler rejects it and asks for a new one.
  await page.goto("/?code=not-a-real-code");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByText("That sign-in link didn't work or has expired")).toBeVisible();
});

test("public pages stay public", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
});

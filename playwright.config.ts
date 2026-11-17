import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI tests the production build; locally we reuse a running dev server if there is one.
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});

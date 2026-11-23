import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Locally the dev server compiles pages on first visit; one worker avoids false failures.
  workers: isCI ? undefined : 1,
  reporter: isCI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    // Default: no database needed (runs in CI).
    {
      name: "chromium",
      testIgnore: /\.db\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Real-database journeys: local only (npm run test:e2e:db).
    {
      name: "db",
      testMatch: /\.db\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI tests the production build; locally we reuse a running dev server if there is one.
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // Tests use the sample Google and sample grid ranking, even if this computer's dev
    // settings (.env.development.local) point at real Google.
    env: { GBP_PROVIDER: "mock", RANK_PROVIDER: "mock" },
  },
});

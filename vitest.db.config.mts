import { defineConfig } from "vitest/config";

/** Integration tests against the real Supabase project (npm run test:db). */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

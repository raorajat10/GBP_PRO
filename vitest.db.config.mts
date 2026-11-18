import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integration tests against the real Supabase project (npm run test:db). */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Lets tests call server modules directly; "server-only" only matters to the bundler.
    alias: {
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

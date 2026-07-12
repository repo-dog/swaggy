import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration suite only — the Playwright browser specs under ui/ run via `pnpm e2e:ui`.
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

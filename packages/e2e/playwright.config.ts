import { defineConfig } from "@playwright/test";

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 4598);
const baseURL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: "ui",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  use: { baseURL, trace: "on-first-retry" },
  // Build the web UI, then boot the mock backend + Swaggy server serving it. Reuse a
  // manually-started server in local dev; always spawn fresh in CI.
  webServer: {
    command: "pnpm --filter @swaggy/web build && pnpm --filter @swaggy/e2e serve",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Browser/e2e runner (Docs/ARCHITECTURE.md "Browser/E2E testing" — Playwright
 * was adopted here; neither Cypress nor Playwright was previously wired up).
 *
 * Prerequisite (not started by this config — it needs a real Postgres/Redis
 * and takes too long to be a "just run it" webServer step): `apps/api`
 * running against a seeded dev database, and `apps/ui`'s dev server. See
 * Docs/ARCHITECTURE.md "Local environment" for the exact commands.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.UI_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

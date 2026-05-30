import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright configuration for the SSO admin app E2E test suite.
 *
 * Tests run against the Vite dev server (port 5175) with a real Kratos
 * instance (port 4433 public / 4434 admin) in the background.
 *
 * NOTE: webServer is omitted because it is Node.js-specific and causes
 * "package.json not found" errors under Deno.  Start the dev server
 * manually (`deno task dev`) before running tests, or use:
 *
 *   deno task dev & sleep 5 && deno task test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "list",

  outputDir: resolve(__dirname, "e2e/screenshots"),

  use: {
    baseURL: "http://localhost:5175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  globalSetup: resolve(__dirname, "e2e/global-setup.ts"),
});

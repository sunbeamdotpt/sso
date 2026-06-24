import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright configuration for the production-like recovery E2E test.
 *
 * This runs against a real Kratos v25.4.0 container configured with:
 *   - domain-scoped (.sunbeam.test), Secure, Lax session cookies
 *   - required_aal: highest_available for settings and whoami
 *   - public base URL under /api/
 *
 * A local TLS reverse proxy makes the SPA available at
 * https://auth.sunbeam.test:4443 without needing to edit /etc/hosts.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /recovery\.prod\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "list",

  outputDir: resolve(__dirname, "e2e/screenshots"),

  use: {
    baseURL: "https://auth.sunbeam.test:4443",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium-prod",
      use: {
        ...devices["Desktop Chrome"],
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: ["--host-resolver-rules=MAP auth.sunbeam.test 127.0.0.1"],
        },
      },
    },
  ],

  globalSetup: resolve(__dirname, "e2e/prod-global-setup.ts"),
});

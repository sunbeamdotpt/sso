import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright configuration for the SSO admin app E2E test suite.
 *
 * Tests run against the real Rust SSO server (port 3102) with the SPA
 * embedded, just like production. The docker-compose stack (Kratos on
 * 4433/4434, Hydra on 4444/4445) must be running.
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
    baseURL: "http://localhost:3102",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  globalSetup: resolve(__dirname, "e2e/global-setup.ts"),

  webServer: {
    command: "deno task build && cargo run --manifest-path api/Cargo.toml",
    url: "http://localhost:3102/health",
    timeout: 300_000,
    reuseExistingServer: !process.env["CI"],
    env: {
      KRATOS_PUBLIC_URL: "http://localhost:4433",
      KRATOS_ADMIN_URL: "http://localhost:4434",
      HYDRA_ADMIN_URL: "http://localhost:4445",
      HYDRA_PUBLIC_URL: "http://localhost:4444",
      RUST_LOG: "info",
    },
  },
});

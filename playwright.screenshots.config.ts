import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright config for generating screenshots without a real Kratos/Hydra backend.
 *
 * The screenshot spec mocks all backend API calls, so no global setup is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /screenshots-mocked\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  workers: 1,
  reporter: "list",

  outputDir: resolve(__dirname, "e2e/screenshots"),

  use: {
    baseURL: "http://localhost:5175",
    trace: "off",
    screenshot: "off",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

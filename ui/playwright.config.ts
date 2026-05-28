import { defineConfig, devices } from "@playwright/test";

/**
 * Random, high-numbered port reserved for Playwright runs only — keeps the
 * test server isolated from local dev (`yarn dev` on 5175) and from any other
 * service binding lower-numbered ports.
 */
const TEST_PORT = 51847;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/integration/**",
  /**
   * Tracked artifact dir — screenshots from every test land here so they can
   * be committed via Git LFS (see `.gitattributes`). Playwright's default
   * `test-results/` is gitignored at the repo root.
   */
  outputDir: "./tests/__screenshots__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: TEST_BASE_URL,
    trace: "retain-on-failure",
    /** Take a screenshot at the end of every test, pass or fail. */
    screenshot: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `yarn dev --port ${TEST_PORT} --strictPort`,
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Integration test config — runs against real services (no mocks).
 *
 * Prerequisites:
 *   docker compose -f ../docker-compose.test.yaml up --wait
 *
 * Every test file receives a pre-authenticated browser context via
 * tests/.states/{admin,user}.json written by global-setup.ts.
 */
const TEST_PORT = 3102;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./tests/integration",
  outputDir: "./tests/__screenshots__",
  fullyParallel: false, // real backend state is shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: TEST_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "on",
  },
  projects: [
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.states/admin.json",
      },
      grepInvert: [/user:/, /anonymous:/],
    },
    {
      name: "user",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.states/user.json",
      },
      grepInvert: [/admin:/, /anonymous:/],
    },
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: [/admin:/, /user:/],
    },
  ],
});

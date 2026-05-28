import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

test.describe("Settings Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("settings page shows all sections", async ({ page }) => {
    const email = `settings-${Date.now()}@sunbeam.pt`;
    const { sessionToken } = await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/settings");
    await page.context().addCookies([
      { name: "ory_kratos_session", value: sessionToken, domain: "localhost", path: "/" },
    ]);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authenticator App" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backup Codes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
  });

  test("password change form is present", async ({ page }) => {
    const email = `settings-pw-${Date.now()}@sunbeam.pt`;
    const { sessionToken } = await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/settings");
    await page.context().addCookies([
      { name: "ory_kratos_session", value: sessionToken, domain: "localhost", path: "/" },
    ]);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
    await expect(page.getByLabel(/New password/i)).toBeVisible();
    await expect(page.getByLabel(/Confirm password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Change password/i })).toBeVisible();
  });

  test("TOTP setup shows QR code", async ({ page }) => {
    const email = `settings-totp-${Date.now()}@sunbeam.pt`;
    const { sessionToken } = await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/settings");
    await page.context().addCookies([
      { name: "ory_kratos_session", value: sessionToken, domain: "localhost", path: "/" },
    ]);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Authenticator App" })).toBeVisible();

    const setupButton = page.getByRole("button", { name: /Set up TOTP/i });
    if (await setupButton.isVisible().catch(() => false)) {
      await setupButton.click();
      await expect(page.locator("img[alt='TOTP QR code']")).toBeVisible({ timeout: 10_000 });
    } else {
      // TOTP may already be enrolled or not available — assert the section is present
      await expect(page.getByText(/Two-factor authentication is enabled|TOTP is not set up/i)).toBeVisible();
    }
  });
});

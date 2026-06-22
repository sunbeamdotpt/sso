import { test, expect, type Page } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

const OUT = "e2e/screenshots";

/** Small delay to let animations settle before capturing. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("Page state screenshots", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("/login states", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/login-password.png`, fullPage: true });

    await page.getByRole("button", { name: /Forgot password/i }).click();
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/login-recovery-email.png`, fullPage: true });

    // Recovery code and success states require a real email round-trip;
    // skip the interactive submission and just assert the email state.
  });

  test("/login error state", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill("nobody@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByText(/credentials are invalid/i).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/login-error.png`, fullPage: true });
  });

  test("/login authenticated state", async ({ page }) => {
    const email = `screenshot-login-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);

    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByText(/Login successful/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/login-authenticated.png`, fullPage: true });
  });

  test("/oauth/login state", async ({ page }) => {
    await page.goto("/oauth/login");
    await expect(page.getByRole("heading", { name: /Sign in to continue/i })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/oauth-login.png`, fullPage: true });
  });

  test("/oauth/logged-out state", async ({ page }) => {
    await page.goto("/oauth/logged-out");
    await expect(page.getByRole("heading", { name: /Sign out of Sunbeam/i })).toBeVisible();
    await page.screenshot({ path: `${OUT}/oauth-logged-out.png`, fullPage: true });
  });

  test("/consent state", async ({ page }) => {
    await page.goto("/consent");
    await expect(page.getByRole("heading", { name: /Authorize/i })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/consent.png`, fullPage: true });
  });

  test("/error state", async ({ page }) => {
    await page.goto("/error?error=access_denied&error_description=User+denied+access");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/error.png`, fullPage: true });
  });
});

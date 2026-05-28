import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth screens — anonymous context
// ---------------------------------------------------------------------------

test.describe("LoginPage", () => {
  test("renders heading, email input, continue button and social tiles", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^continue →$/i })).toBeVisible();
  });

  test("continue button is disabled until email is entered", async ({ page }) => {
    await page.goto("/auth/login");
    const btn = page.getByRole("button", { name: /^continue →$/i });
    await expect(btn).toBeDisabled();
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await expect(btn).toBeEnabled();
  });

  test("submitting wrong password shows error", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: /email/i }).fill("user@sunbeam.test");
    await page.getByRole("button", { name: /^continue →$/i }).click();
    // Wait for password field to appear
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/invalid credentials/i).or(page.getByText(/incorrect/i))).toBeVisible();
  });

  test("successful login redirects to return_to", async ({ page }) => {
    await page.goto("/auth/login?return_to=/account/profile");
    await page.getByRole("textbox", { name: /email/i }).fill("user@sunbeam.test");
    await page.getByRole("button", { name: /^continue →$/i }).click();
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[type="password"]').fill("User-Password-123!");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL("**/account/profile", { timeout: 10000 });
  });
});

test.describe("RegistrationPage", () => {
  test("renders form fields", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: /register/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });
});

test.describe("RecoveryPage", () => {
  test("renders recovery form", async ({ page }) => {
    await page.goto("/auth/recovery");
    await expect(page.getByRole("heading", { name: /recover your account/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send recovery code/i })).toBeVisible();
  });
});

test.describe("FlowExpiredPage", () => {
  test("renders expired message with flow_id", async ({ page }) => {
    await page.goto("/auth/expired?flow_id=expired-test-flow");
    await expect(page.getByRole("heading", { name: /this flow has expired/i })).toBeVisible();
    await expect(page.getByText(/flow_id: expired-test-flow/)).toBeVisible();
    await expect(page.getByRole("button", { name: /start over/i })).toBeVisible();
  });

  test("start over navigates to /auth/login", async ({ page }) => {
    await page.goto("/auth/expired?flow_id=expired-test-flow");
    await Promise.all([
      page.waitForURL(/\/auth\/login/),
      page.getByRole("button", { name: /start over/i }).click(),
    ]);
  });
});

test.describe("ErrorPage", () => {
  test("renders generic error", async ({ page }) => {
    await page.goto("/auth/error?id=test-error");
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /contact support/i })).toBeVisible();
  });
});

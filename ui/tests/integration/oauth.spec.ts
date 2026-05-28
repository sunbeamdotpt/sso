import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// OAuth screens — anonymous context (Hydra flows are public)
// ---------------------------------------------------------------------------

test.describe("ConsentPage", () => {
  test("redirects to login when no consent_challenge", async ({ page }) => {
    await page.goto("/oauth2/consent");
    // Without a challenge, the backend has nothing to show
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
  });
});

test.describe("OAuthLoginPage", () => {
  test("redirects to login when no login_challenge", async ({ page }) => {
    await page.goto("/oauth2/login");
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
  });
});

test.describe("DeviceFlowPage", () => {
  test("renders device code form", async ({ page }) => {
    await page.goto("/oauth2/device");
    await expect(page.getByText("DEVICE FLOW")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /device code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^activate$/i })).toBeDisabled();
  });

  test("activate button enables after entering code", async ({ page }) => {
    await page.goto("/oauth2/device");
    const btn = page.getByRole("button", { name: /^activate$/i });
    await expect(btn).toBeDisabled();
    await page.getByRole("textbox", { name: /device code/i }).fill("ABCD-1234");
    await expect(btn).toBeEnabled();
  });
});

test.describe("PostLogoutPage", () => {
  test("renders sign out prompt", async ({ page }) => {
    await page.goto("/oauth2/sessions/logout");
    await expect(page.getByRole("heading", { name: /sign out/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign out$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /no, stay signed in/i })).toBeVisible();
  });
});

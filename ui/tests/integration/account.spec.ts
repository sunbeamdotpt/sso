import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Account screens — authenticated contexts (admin + user)
// ---------------------------------------------------------------------------

test.describe("ProfilePage", () => {
  test("admin: renders profile with prefilled fields", async ({ page }) => {
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Admin User");
    await expect(page.getByLabel("Email (verified)")).toHaveValue("admin@sunbeam.test");
  });

  test("user: renders profile with prefilled fields", async ({ page }) => {
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Regular User");
    await expect(page.getByLabel("Email (verified)")).toHaveValue("user@sunbeam.test");
  });

  test("anonymous: redirects to login", async ({ page }) => {
    await page.goto("/account/profile");
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
  });
});

test.describe("SecurityPage", () => {
  test("admin: renders security sections", async ({ page }) => {
    await page.goto("/account/security");
    await expect(page.getByRole("heading", { level: 2, name: "Security" })).toBeVisible();
    await expect(page.getByText("PASSWORD").first()).toBeVisible();
    await expect(page.getByText("TWO-FACTOR").first()).toBeVisible();
  });

  test("user: renders security sections", async ({ page }) => {
    await page.goto("/account/security");
    await expect(page.getByRole("heading", { level: 2, name: "Security" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  });
});

test.describe("AccountSessionsPage", () => {
  test("admin: shows active sessions", async ({ page }) => {
    await page.goto("/account/sessions");
    await expect(page.getByRole("heading", { level: 2, name: "Active sessions" })).toBeVisible();
    await expect(page.getByText("THIS DEVICE")).toBeVisible();
  });

  test("user: shows active sessions", async ({ page }) => {
    await page.goto("/account/sessions");
    await expect(page.getByRole("heading", { level: 2, name: "Active sessions" })).toBeVisible();
    await expect(page.getByText("THIS DEVICE")).toBeVisible();
  });
});

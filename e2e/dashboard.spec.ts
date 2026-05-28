import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays app title and subtitle", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Sunbeam SSO/i })).toBeVisible();
    await expect(page.getByText(/Identity & self-service administration/i)).toBeVisible();
  });

  test("displays Kratos version", async ({ page }) => {
    await expect(page.getByText(/Kratos version:/i)).toBeVisible({ timeout: 10_000 });
    const versionText = await page.locator("text=Kratos version:").textContent();
    expect(versionText).toMatch(/v?\d+\.\d+/);
  });

  test("navigation grid has 7 cards", async ({ page }) => {
    const dashboardNav = page.getByRole("navigation", { name: "Dashboard navigation" });
    const cards = dashboardNav.locator("> a");
    await expect(cards).toHaveCount(7);
  });

  test("navigation cards link to correct routes", async ({ page }) => {
    const links = [
      { name: /Identities/i, href: /\/identities/ },
      { name: /Login Flows/i, href: /\/login/ },
      { name: /Registration/i, href: /\/registration/ },
      { name: /Recovery/i, href: /\/recovery/ },
      { name: /Settings/i, href: /\/settings/ },
      { name: /Verification/i, href: /\/verification/ },
      { name: /Health/i, href: /\/health/ },
    ];

    const dashboardNav = page.getByRole("navigation", { name: "Dashboard navigation" });
    for (const { name, href } of links) {
      const link = dashboardNav.getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
  });

  test("Identities card navigates to identities list", async ({ page }) => {
    const dashboardNav = page.getByRole("navigation", { name: "Dashboard navigation" });
    await dashboardNav.getByRole("link", { name: /Identities/i }).click();
    await expect(page).toHaveURL(/\/identities/);
    await expect(page.getByRole("heading", { name: /Identities/i })).toBeVisible();
  });
});

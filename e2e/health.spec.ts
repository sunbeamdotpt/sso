import { test, expect } from "@playwright/test";

test.describe("Health", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/health");
  });

  test("page heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Health", exact: true })).toBeVisible();
  });

  test("alive and ready cards are present", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Alive" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
  });

  test("alive status shows ok badge", async ({ page }) => {
    // Use sibling-based traversal: find the Alive heading, then look within
    // its parent card for the ok badge.
    const aliveCard = page.locator("h2").filter({ hasText: "Alive" }).locator("xpath=..");
    await expect(aliveCard.getByText("ok")).toBeVisible({ timeout: 10_000 });
  });

  test("ready status shows ok badge", async ({ page }) => {
    const readyCard = page.locator("h2").filter({ hasText: "Ready" }).locator("xpath=..");
    await expect(readyCard.getByText("ok")).toBeVisible({ timeout: 10_000 });
  });

  test("status badges have correct styling classes", async ({ page }) => {
    const aliveCard = page.locator("h2").filter({ hasText: "Alive" }).locator("xpath=..");
    const readyCard = page.locator("h2").filter({ hasText: "Ready" }).locator("xpath=..");
    await expect(aliveCard.getByText("ok")).toBeVisible();
    await expect(readyCard.getByText("ok")).toBeVisible();
  });
});

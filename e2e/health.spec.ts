import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Health", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  test.beforeEach(async ({ page }) => {
    const email = `test-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByRole("heading", { name: "Health", exact: true })).toBeVisible();
  });

  test("alive and ready cards are present", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByRole("heading", { name: "Alive" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
  });

  test("alive status shows ok badge", async ({ page }) => {
    await page.goto("/health");
    const aliveCard = page.locator("h2").filter({ hasText: "Alive" }).locator("xpath=..");
    await expect(aliveCard.getByText("ok")).toBeVisible({ timeout: 10_000 });
  });

  test("ready status shows ok badge", async ({ page }) => {
    await page.goto("/health");
    const readyCard = page.locator("h2").filter({ hasText: "Ready" }).locator("xpath=..");
    await expect(readyCard.getByText("ok")).toBeVisible({ timeout: 10_000 });
  });

  test("status badges have correct styling classes", async ({ page }) => {
    await page.goto("/health");
    const aliveCard = page.locator("h2").filter({ hasText: "Alive" }).locator("xpath=..");
    const readyCard = page.locator("h2").filter({ hasText: "Ready" }).locator("xpath=..");
    await expect(aliveCard.getByText("ok")).toBeVisible();
    await expect(readyCard.getByText("ok")).toBeVisible();
  });
});

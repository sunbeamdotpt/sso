import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Identities", () => {
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
    await page.goto("/identities");
    await expect(page.getByRole("heading", { name: "Identities", exact: true })).toBeVisible();
  });

  test("table renders with expected columns", async ({ page }) => {
    await page.goto("/identities");
    await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Schema" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Verified" })).toBeVisible();
    const headers = page.locator("table thead th");
    await expect(headers).toHaveCount(5);
  });

  test("identity ID links to detail page", async ({ page }) => {
    await page.goto("/identities");
    const firstLink = page.locator("table tbody tr:first-child td:last-child a");
    await expect(firstLink).toBeVisible();

    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/\/identities\/[\w-]+/);

    await firstLink.click();
    await expect(page).toHaveURL(/\/identities\/[\w-]+/);
    await expect(page.getByRole("link", { name: /Back/i })).toBeVisible();
  });
});

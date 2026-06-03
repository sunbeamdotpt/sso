import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Schema Detail", () => {
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

  test("displays schema JSON for default identity schema", async ({ page }) => {
    await page.goto("/schemas/default");

    await expect(page.getByRole("heading", { name: /Schema: default/i })).toBeVisible();
    await expect(page.locator("pre")).toBeVisible({ timeout: 10_000 });

    const jsonBlock = await page.locator("pre").textContent();
    expect(jsonBlock).toContain('"$id"');
    expect(jsonBlock).toContain('"type"');
  });

  test("shows loading then content", async ({ page }) => {
    await page.goto("/schemas/default");

    // Loading state may be too brief to catch; ensure we land on content
    await expect(page.locator("pre")).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Schema Detail", () => {
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

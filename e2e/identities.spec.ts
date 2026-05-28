import { test, expect } from "@playwright/test";

test.describe("Identities", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/identities");
  });

  test("page heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Identities", exact: true })).toBeVisible();
  });

  test("table renders with expected columns", async ({ page }) => {
    await expect(page.locator("th")).toHaveCount(5);
    await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Schema" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Verified" })).toBeVisible();
  });

  test("seeded identities are displayed", async ({ page }) => {
    await expect(page.getByText("test-user-1@sunbeam.pt")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("test-user-2@sunbeam.pt")).toBeVisible();
    await expect(page.getByText("admin@sunbeam.pt")).toBeVisible();
  });

  test("identity ID links to detail page", async ({ page }) => {
    const firstLink = page.locator("table tbody tr:first-child td:nth-child(2) a");
    await expect(firstLink).toBeVisible();

    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/\/identities\/[\w-]+/);

    await firstLink.click();
    await expect(page).toHaveURL(/\/identities\/[\w-]+/);
    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
  });
});

test.describe("Identity Detail", () => {
  test("displays identity fields", async ({ page }) => {
    await page.goto("/identities");

    // Navigate to first identity
    const firstLink = page.locator("table tbody tr:first-child td:nth-child(2) a");
    await firstLink.click();

    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
    await expect(page.getByText("Schema ID")).toBeVisible();
    await expect(page.getByText("default")).toBeVisible();
    await expect(page.getByText("Schema URL")).toBeVisible();
    await expect(page.getByText("Traits")).toBeVisible();
  });

  test("delete button is present and functional", async ({ page }) => {
    await page.goto("/identities");

    // Navigate to first identity
    const firstLink = page.locator("table tbody tr:first-child td:nth-child(2) a");
    await firstLink.click();

    const deleteBtn = page.getByRole("button", { name: /Delete Identity/i });
    await expect(deleteBtn).toBeVisible();

    // Cancel the confirm dialog so we don't actually delete during this test
    page.on("dialog", (dialog) => dialog.dismiss());
    await deleteBtn.click();

    // Should still be on detail page after dismiss
    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
  });
});

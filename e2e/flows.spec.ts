import { test, expect } from "@playwright/test";

test.describe("Self-Service Flows", () => {
  test.describe("Login Flow", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("page heading and structure", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Login Flow" })).toBeVisible();
    });

    test("displays flow metadata", async ({ page }) => {
      await expect(page.locator("span", { hasText: /^Flow ID$/ }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("span", { hasText: /^Type$/ }).first()).toBeVisible();
      await expect(page.locator("span", { hasText: /^UI Action$/ }).first()).toBeVisible();
    });

    test("renders JSON payload", async ({ page }) => {
      const jsonBlock = page.locator("pre").first();
      await expect(jsonBlock).toBeVisible();
      const text = await jsonBlock.textContent();
      expect(text).toContain('"id"');
      expect(text).toContain('"type"');
    });
  });


  test.describe("Recovery Flow", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/recovery");
    });

    test("page heading and structure", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Recovery Flow" })).toBeVisible();
    });

    test("displays flow metadata", async ({ page }) => {
      await expect(page.locator("span", { hasText: /^Flow ID$/ }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("span", { hasText: /^State$/ }).first()).toBeVisible();
    });
  });

  test.describe("Verification Flow", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/verification");
    });

    test("page heading and structure", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Verification Flow" })).toBeVisible();
    });

    test("displays flow metadata", async ({ page }) => {
      await expect(page.locator("span", { hasText: /^Flow ID$/ }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("span", { hasText: /^State$/ }).first()).toBeVisible();
    });
  });
});

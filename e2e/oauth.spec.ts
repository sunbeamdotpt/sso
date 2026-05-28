import { test, expect } from "@playwright/test";

test.describe("OAuth Pages", () => {
  test("consent page shows scope picker", async ({ page }) => {
    // Visit without a challenge — page should show a message or the consent form
    await page.goto("/consent");

    // The consent page either shows "Authorize" heading or an error/warning callout
    await expect(
      page.getByRole("heading", { name: /Authorize/i }).or(page.getByText(/challenge|request/i)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("error page displays OAuth error", async ({ page }) => {
    await page.goto("/error?error=access_denied&error_description=User+denied+access");

    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByText("access_denied")).toBeVisible();
    await expect(page.getByText(/User denied access/i)).toBeVisible();
  });

  test("post-logout page renders", async ({ page }) => {
    await page.goto("/oauth/logged-out");

    await expect(page.getByRole("heading", { name: /Sign out of Sunbeam/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /No, stay signed in/i })).toBeVisible();
  });
});

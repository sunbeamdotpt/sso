import { expect, test } from "@playwright/test";

test.describe("OAuth Pages", () => {
  test("consent page shows scope picker", async ({ page }) => {
    // Visit without a challenge — page should show a message or the consent form
    await page.goto("/consent");

    // The consent page shows "Authorize" heading when rendered
    await expect(
      page.getByRole("heading", { name: /Authorize/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("error page displays OAuth error", async ({ page }) => {
    await page.goto(
      "/error?error=access_denied&error_description=User+denied+access",
    );

    await expect(page.getByRole("heading", { name: "Something went wrong" }))
      .toBeVisible();
    await expect(page.getByText("access_denied")).toBeVisible();
    await expect(page.getByText(/User denied access/i)).toBeVisible();
  });

  test("post-logout page renders", async ({ page }) => {
    await page.goto("/oauth/logged-out");

    await expect(page.getByRole("heading", { name: /Sign out of Sunbeam/i }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /No, stay signed in/i }))
      .toBeVisible();
  });

  test("OAuth login page renders", async ({ page }) => {
    await page.goto("/oauth/login");

    await expect(page.getByRole("heading", { name: /Sign in to continue/i }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });
});

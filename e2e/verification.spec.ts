import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

test.describe("Verification Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("verification flow sends code to email", async ({ page }) => {
    const email = `verify-${Date.now()}@sunbeam.pt`;
    await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/verification");
    await expect(page.getByRole("heading", { name: "Verify your email address" })).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: /Send verification code/i }).click();

    await expect(
      page.getByText(/Verification email sent|Check your inbox|code/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

test.describe("Recovery Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("recovery flow sends code to email", async ({ page }) => {
    const email = `recovery-${Date.now()}@sunbeam.pt`;
    await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Recover your account" })).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: /Send recovery code/i }).click();

    // Should show success toast or transition to code step
    await expect(
      page.getByText(/Recovery email sent|Check your inbox|code/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("recovery flow shows code entry after email submit", async ({ page }) => {
    const email = `recovery-code-${Date.now()}@sunbeam.pt`;
    await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");

    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Recover your account" })).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: /Send recovery code/i }).click();

    await expect(page.getByLabel(/Recovery code/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Verify code/i })).toBeVisible();
  });
});

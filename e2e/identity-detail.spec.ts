import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createIdentity } from "./utils/kratos.ts";

test.describe("Identity Detail", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("delete identity navigates to identities list", async ({ page }) => {
    const email = `delete-me-${Date.now()}@sunbeam.pt`;
    const identity = await createIdentity({ email });

    await page.goto(`/identities/${identity.id}`);
    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Delete Identity/i }).click();

    await expect(page).toHaveURL("/identities");
    await expect(page.getByRole("heading", { name: "Identities" })).toBeVisible();
  });
});

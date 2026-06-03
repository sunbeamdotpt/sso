import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity, createIdentity } from "./utils/kratos.ts";

async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Identity Detail", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  let currentIdentityId = "";

  test.beforeEach(async ({ page }) => {
    const email = `test-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    const { identity } = await createAuthenticatedIdentity(email, password);
    currentIdentityId = identity.id;
    await sqliteDelay();

    await page.goto("/login");
    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("displays own identity fields", async ({ page }) => {
    await page.goto(`/identities/${currentIdentityId}`);

    await expect(page.getByRole("link", { name: /Back/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Traits" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Addresses" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Metadata" })).toBeVisible();
    await expect(page.getByText("Schema ID")).toBeVisible();
    await expect(page.getByText("Schema URL")).toBeVisible();

    // Own identity: Edit visible, Delete hidden (non-admin)
    await expect(page.getByRole("button", { name: /Edit/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).not.toBeVisible();
  });

  test("other identity hides edit and delete for non-admin non-owner", async ({ page }) => {
    // Create another identity
    const other = await createIdentity({ email: `other-${Date.now()}@sunbeam.pt` });
    await sqliteDelay();

    await page.goto(`/identities/${other.id}`);

    await expect(page.getByRole("link", { name: /Back/i })).toBeVisible();
    await expect(page.getByText("Schema ID")).toBeVisible();

    // Non-owner non-admin: neither Edit nor Delete visible
    await expect(page.getByRole("button", { name: /Edit/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).not.toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

/** Small delay between tests that hit Kratos SQLite to avoid "database is locked". */
async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Auth Flows", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    const email = `login-valid-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sunbeam SSO" })).toBeVisible();
    await expect(page.getByText(/Sign in to your account/i)).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in with password/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Sunbeam SSO/i })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sunbeam SSO" })).toBeVisible();
    await expect(page.getByText(/Sign in to your account/i)).toBeVisible();

    await page.getByLabel("E-Mail").fill("nobody@sunbeam.pt");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: /Sign in with password/i }).click();

    await expect(page.getByText(/credentials are invalid/i)).toBeVisible({ timeout: 10_000 });
  });

  test("logout redirects to login", async ({ page }) => {
    const email = `logout-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    // Log in via browser to get a real session cookie
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in with password/i }).click();
    await expect(page).toHaveURL("/");

    // Open user menu and log out
    await page.getByLabel("User menu").click();
    await page.getByRole("menuitem", { name: /Log out/i }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sunbeam SSO" })).toBeVisible();
    await expect(page.getByText(/Sign in to your account/i)).toBeVisible();
  });
});

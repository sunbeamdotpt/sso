import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

test.describe("Auth Flows", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    const email = `login-valid-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in with password/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Sunbeam SSO/i })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    await page.getByLabel("E-Mail").fill("nobody@sunbeam.pt");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: /Sign in with password/i }).click();

    await expect(page.getByText(/identifier or password/i)).toBeVisible({ timeout: 10_000 });
  });

  test("registration creates account and redirects", async ({ page }) => {
    const email = `register-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";

    await page.goto("/registration");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Sunbeam SSO/i })).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    const email = `logout-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    const { sessionToken } = await createAuthenticatedIdentity(email, password);

    await page.goto("/");
    await page.context().addCookies([
      { name: "ory_kratos_session", value: sessionToken, domain: "localhost", path: "/" },
    ]);

    // Refresh so the auth provider picks up the session
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Sunbeam SSO/i })).toBeVisible();

    await page.getByRole("button", { name: /Log out/i }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  });
});

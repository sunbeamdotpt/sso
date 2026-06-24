import { expect, test } from "@playwright/test";
import {
  cleanupAllIdentities,
  createAuthenticatedIdentity,
  getLatestRecoveryCode,
} from "./utils/kratos.ts";

/** Small delay between tests that hit Kratos SQLite to avoid "database is locked". */
async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

test.describe("Auth Flows", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  test("login with valid credentials shows success", async ({ page }) => {
    const email = `login-valid-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel(/Username or Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Remember me/i }))
      .toBeVisible();

    await page.getByLabel(/Username or Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    // The toast auto-dismisses quickly, so assert the persistent session state
    // (Log out button in the header) rather than the transient toast text.
    await expect(page.getByRole("button", { name: /Log out/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    await page.getByLabel(/Username or Email/i).fill("nobody@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    await expect(page.getByText(/credentials are invalid/i).first())
      .toBeVisible({ timeout: 10_000 });
  });

  test("logout redirects to login", async ({ page }) => {
    const email = `logout-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByRole("button", { name: /Log out/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /Log out/i }).click();

    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("account recovery flow on dedicated recovery page", async ({ page }) => {
    const email = `recovery-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByRole("link", { name: /Forgot your password/i }).click();

    await expect(page).toHaveURL("/recovery");
    await expect(page.getByRole("heading", { name: "Reset your password" }))
      .toBeVisible();
    await page.getByLabel(/Email/i).fill(email);
    await page.getByRole("button", { name: /Send Recovery Code/i }).click();

    await expect(page.getByText(/Enter the recovery code/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("full account recovery resets password", async ({ page }) => {
    const email = `recovery-full-${Date.now()}@sunbeam.pt`;
    const oldPassword = "xK9#mQ2$pL7@vN4&wR1!";
    const newPassword = "yL8#nP4$qM9@bK2&xT3!";
    await createAuthenticatedIdentity(email, oldPassword);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByRole("link", { name: /Forgot your password/i }).click();

    await expect(page).toHaveURL("/recovery");
    await page.getByLabel(/Email/i).fill(email);
    await page.getByRole("button", { name: /Send Recovery Code/i }).click();

    await expect(page.getByText(/Enter the recovery code/i)).toBeVisible({
      timeout: 10_000,
    });

    const code = await getLatestRecoveryCode(email);
    await page.getByLabel(/Recovery code/i).fill(code);
    await page.getByRole("button", { name: /Verify Code/i }).click();

    // Kratos returns a privileged settings flow after the code is verified.
    await expect(page).toHaveURL(/\/recovery\/reset\?flow=/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Set a new password" }))
      .toBeVisible();

    await page.getByLabel(/New password/i).fill(newPassword);
    await page.getByRole("button", { name: /Update Password/i }).click();

    await expect(page.getByText(/Password updated/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("authenticated visit to /login does not loop", async ({ page }) => {
    const email = `auth-redirect-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    // Sign in first.
    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByRole("button", { name: /Log out/i })).toBeVisible({
      timeout: 10_000,
    });

    // Visiting /login again with an active session must create a flow and
    // render it, not bounce to /api/self-service/login/browser forever.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login\?flow=.+/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });
});

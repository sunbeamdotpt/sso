import { expect, test } from "@playwright/test";
import {
  createAuthenticatedIdentity,
  getLatestRecoveryCode,
} from "./utils/kratos.ts";

/**
 * End-to-end recovery flow against the production-like Kratos configuration.
 *
 * The test runs on https://auth.sunbeam.test:4443 with a domain-scoped
 * (.sunbeam.test), Secure, Lax session cookie and Kratos public base URL
 * including the /api prefix. This exercises the backend proxy fixes that
 * forward the Host header, preserve multiple Set-Cookie headers, and sanitize
 * stale session cookies.
 */
test.describe("Production recovery flow", () => {
  test("unlogged-in user can reset password via email recovery", async ({ page }) => {
    const email = `prod-recovery-${Date.now()}@sunbeam.test`;
    const oldPassword = "InitialPass123!";
    const newPassword = "NewSecurePass456!";

    // Seed a verified identity so the recovery email is sent.
    await createAuthenticatedIdentity(email, oldPassword);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    await page.getByRole("link", { name: /Forgot your password/i }).click();

    await expect(page).toHaveURL("/recovery");
    await expect(page.getByRole("heading", { name: "Reset your password" }))
      .toBeVisible();

    await page.getByLabel(/Email/i).fill(email);
    await page.getByRole("button", { name: /Send Recovery Code/i }).click();

    await expect(page.getByText(/Enter the recovery code/i)).toBeVisible({
      timeout: 10_000,
    });

    const code = await getLatestRecoveryCode(email);
    await page.getByLabel(/Recovery code/i).fill(code);
    await page.getByRole("button", { name: /Verify Code/i }).click();

    // Kratos returns a privileged settings flow after the code is verified.
    await expect(page).toHaveURL(/\/recovery\/reset\?flow=/, {
      timeout: 10_000,
    });

    // The recovery-code response must have set a domain-scoped session cookie;
    // without it the settings flow fetch will 401 and the update button does
    // nothing.
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === "ory_kratos_session" && c.domain === ".sunbeam.test",
    );
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(true);

    await expect(page.getByRole("heading", { name: "Set a new password" }))
      .toBeVisible();

    await page.getByLabel(/New password/i).fill(newPassword);
    await page.getByRole("button", { name: /Update Password/i }).click();

    await expect(page.getByRole("heading", { name: "Password updated" }))
      .toBeVisible({ timeout: 10_000 });

    // Sign in with the new password to confirm the reset took effect.
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    await page.getByLabel(/Username or Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(newPassword);
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    await expect(page.getByRole("button", { name: /Log out/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

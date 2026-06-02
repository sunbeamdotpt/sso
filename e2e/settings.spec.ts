import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

/** Small delay between Kratos DB operations to avoid SQLite locking. */
async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Log in via the browser UI and land on the dashboard.
 */
async function loginViaUI(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.locator('input[type="text"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /SIGN IN/i }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Simple base32 decoder for TOTP secrets.
 */
function base32Decode(str: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = str.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  const bits = cleaned
    .split("")
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

/**
 * Generate a TOTP code for the given secret at the given time-step offset.
 */
async function generateTOTP(secret: string, delta = 0): Promise<string> {
  const key = base32Decode(secret);
  const timeStep = Math.floor(Date.now() / 1000 / 30) + delta;
  const counter = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    counter[i] = temp & 0xff;
    temp >>= 8;
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counter);
  const hash = new Uint8Array(signature);
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

/**
 * Enroll TOTP for the current session by calling Kratos APIs directly
 * in the browser context. Returns the enrolled secret.
 */
async function enrollTotpViaAPI(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(async () => {
    function base32Decode(str: string): Uint8Array {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const cleaned = str.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
      const bits = cleaned
        .split("")
        .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
        .join("");
      const bytes: number[] = [];
      for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
      }
      return new Uint8Array(bytes);
    }

    async function generateTOTP(secret: string, delta = 0): Promise<string> {
      const key = base32Decode(secret);
      const timeStep = Math.floor(Date.now() / 1000 / 30) + delta;
      const counter = new Uint8Array(8);
      let temp = timeStep;
      for (let i = 7; i >= 0; i--) {
        counter[i] = temp & 0xff;
        temp >>= 8;
      }
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key.buffer as ArrayBuffer,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", cryptoKey, counter);
      const hash = new Uint8Array(signature);
      const offset = hash[hash.length - 1] & 0x0f;
      const code =
        (((hash[offset] & 0x7f) << 24) |
          ((hash[offset + 1] & 0xff) << 16) |
          ((hash[offset + 2] & 0xff) << 8) |
          (hash[offset + 3] & 0xff)) %
        1_000_000;
      return code.toString().padStart(6, "0");
    }

    // 1. Get settings flow
    const flowRes = await fetch("/self-service/settings/browser", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    const flow = await flowRes.json();
    const action = flow.ui.action;
    const csrf = flow.ui.nodes.find((n: Record<string, unknown>) =>
      (n.attributes as Record<string, unknown>).name === "csrf_token"
    )?.attributes?.value ?? "";

    // 2. Submit TOTP setup to get QR code
    const setupRes = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ method: "totp", csrf_token: csrf }),
    });
    const setupFlow = await setupRes.json();
    const setupAction = setupFlow.ui.action;
    const setupCsrf = setupFlow.ui.nodes.find((n: Record<string, unknown>) =>
      (n.attributes as Record<string, unknown>).name === "csrf_token"
    )?.attributes?.value ?? "";

    // 3. Extract secret
    const secretNode = setupFlow.ui.nodes.find(
      (n: Record<string, unknown>) => n.group === "totp" && n.type === "text",
    );
    const secret = (secretNode?.attributes as Record<string, unknown>)?.text?.context?.secret as string ?? "";

    // 4. Generate code and verify
    for (const delta of [0, -1, 1]) {
      const code = await generateTOTP(secret, delta);
      const verifyRes = await fetch(setupAction, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ method: "totp", totp_code: code, csrf_token: setupCsrf }),
      });
      const verifyData = await verifyRes.json();
      const hasUnlink = verifyData.ui?.nodes?.some(
        (n: Record<string, unknown>) =>
          n.group === "totp" && (n.attributes as Record<string, unknown>).name === "totp_unlink",
      );
      if (hasUnlink) return secret;
    }

    throw new Error("Failed to enroll TOTP via API");
  });
}

test.describe("Settings Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  test("settings page shows all sections and back button", async ({ page }) => {
    const email = `settings-sections-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authenticator App" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backup Codes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connected Accounts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();

    const backLink = page.getByRole("link", { name: /Back/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/");
  });

  test("back button navigates to dashboard", async ({ page }) => {
    const email = `settings-back-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await page.getByRole("link", { name: /Back/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("profile section displays and updates traits", async ({ page }) => {
    const email = `settings-profile-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    // Email should be visible in the profile form
    await expect(page.getByLabel(/E-MAIL/i)).toHaveValue(email);

    // Fill profile fields
    await page.getByLabel(/First Name/i).fill("E2E");
    await page.getByLabel(/Last Name/i).fill("Test");
    await page.getByLabel(/Display Name/i).fill("E2E Display");
    await page.getByLabel(/Phone/i).fill("+1234567890");

    await page.getByRole("button", { name: /Save profile/i }).click();

    // Success toast
    await expect(page.getByText(/Success/i)).toBeVisible();

    // Reload and verify values persisted
    await page.reload();
    await expect(page.getByLabel(/First Name/i)).toHaveValue("E2E");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Test");
    await expect(page.getByLabel(/Display Name/i)).toHaveValue("E2E Display");
    await expect(page.getByLabel(/Phone/i)).toHaveValue("+1234567890");
  });

  test("TOTP setup flow — QR code, invalid code error, and cancel", async ({ page }) => {
    const email = `settings-totp-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Authenticator App" })).toBeVisible();

    const setupButton = page.getByRole("button", { name: /Set up TOTP/i });
    await expect(setupButton).toBeVisible();
    await setupButton.click();

    // QR code and secret should appear
    await expect(page.locator("img[alt='TOTP QR code']")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Secret:/i)).toBeVisible();

    const secretCode = await page.locator("code").filter({ hasText: /^[A-Z2-7]+$/i }).textContent();
    expect(secretCode).toBeTruthy();

    // Enter an invalid code and verify
    await page.getByLabel(/Verification code/i).fill("000000");
    await page.getByRole("button", { name: /Verify/i }).click();

    // Should show error (either toast or inline)
    await expect(
      page.getByText(/invalid|incorrect|wrong|error/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Cancel should return to list view
    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByRole("button", { name: /Set up TOTP/i })).toBeVisible();
  });

  test("TOTP full enrollment and removal", async ({ page }) => {
    const email = `settings-totp-full-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    // Start TOTP setup
    await page.getByRole("button", { name: /Set up TOTP/i }).click();
    await expect(page.locator("img[alt='TOTP QR code']")).toBeVisible({ timeout: 10_000 });

    // Extract secret and enroll via UI
    const secretText = await page
      .locator("code")
      .filter({ hasText: /^[A-Z2-7]+$/i })
      .textContent();
    expect(secretText).toBeTruthy();
    // Enter valid code and verify via UI
    const totpCode = await generateTOTP(secretText!);
    await page.getByLabel(/Verification code/i).fill(totpCode);
    await page.getByRole("button", { name: /Verify/i }).click();

    // Should show enrolled state
    await expect(
      page.getByText(/Two-factor authentication is enabled/i),
    ).toBeVisible({ timeout: 10_000 });

    // Remove TOTP
    await page.getByRole("button", { name: /Remove TOTP/i }).click();

    // Should return to not-set-up state
    await expect(page.getByText(/TOTP is not set up/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Set up TOTP/i })).toBeVisible();
  });

  test("backup codes section renders and shows error when not configured", async ({ page }) => {
    const email = `settings-backup-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Backup Codes" })).toBeVisible();
    await expect(page.getByText(/No backup codes generated/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate backup codes/i })).toBeVisible();

    // Clicking generate without lookup_secret configured shows error toast
    await page.getByRole("button", { name: /Generate backup codes/i }).click();
    await expect(page.getByText(/Could not find a strategy/i)).toBeVisible({ timeout: 10_000 });
  });

  test("passkeys section shows UI when none registered", async ({ page }) => {
    const email = `settings-passkeys-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
    await expect(page.getByText(/No passkeys registered/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Add passkey/i })).toBeVisible();
  });

  test("connected accounts section renders", async ({ page }) => {
    const email = `settings-oidc-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Connected Accounts" })).toBeVisible();

    // With no OAuth providers configured, shows empty state
    await expect(page.getByText(/No social providers available/i)).toBeVisible();
  });

  test("password change form validates matching passwords", async ({ page }) => {
    const email = `settings-pw-validate-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await page.getByLabel(/New password/i).fill("NewPassword123!");
    await page.getByLabel(/Confirm password/i).fill("DifferentPassword123!");
    await page.getByRole("button", { name: /Change password/i }).click();

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
  });

  test("password change works and allows login with new password", async ({ page }) => {
    const email = `settings-pw-change-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    const newPassword = "yL8$nQ3@mK6@wP5&xR2!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    await page.getByLabel(/New password/i).fill(newPassword);
    await page.getByLabel(/Confirm password/i).fill(newPassword);
    await page.getByRole("button", { name: /Change password/i }).click();

    await expect(page.getByText(/Success/i)).toBeVisible();

    // Clear session and login with new password
    await page.context().clearCookies();
    await page.goto("/login");

    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(newPassword);
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    await expect(page).toHaveURL("/");
  });

  test("scrollable area contains settings content", async ({ page }) => {
    const email = `settings-scroll-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();
    await loginViaUI(page, email, password);

    await page.goto("/settings");

    // All sections should be discoverable within the page
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
  });
});

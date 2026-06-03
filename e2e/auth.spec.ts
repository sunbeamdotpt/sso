import { test, expect, type Page } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

/** Small delay between tests that hit Kratos SQLite to avoid "database is locked". */
async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
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
async function enrollTotpViaAPI(page: Page): Promise<string> {
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

/**
 * Clear all cookies except the one with the given name.
 */
async function clearCookiesExcept(page: Page, name: string): Promise<void> {
  const cookies = await page.context().cookies();
  await page.context().clearCookies();
  const keep = cookies.filter((c) => c.name === name);
  if (keep.length > 0) {
    await page.context().addCookies(keep);
  }
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
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel(/Username or email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Remember me/i })).toBeVisible();
    await expect(page.getByText(/Forgot your password/i)).toBeVisible();
    await expect(page.getByText(/Don't have an account/i)).toBeVisible();

    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Sunbeam SSO" })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    await page.getByLabel(/Username or email/i).fill("nobody@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /SIGN IN/i }).click();

    await expect(page.getByText(/credentials are invalid/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("logout redirects to login", async ({ page }) => {
    const email = `logout-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    // Log in via browser to get a real session cookie
    await page.goto("/login");
    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page).toHaveURL("/");

    // Open user menu and log out
    await page.getByLabel("User menu").click();
    await page.getByRole("menuitem", { name: /Log out/i }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("login without remember me logs out on new browser session", async ({ page }) => {
    const email = `no-remember-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page).toHaveURL("/");

    // Simulate a new browser session: clear sessionStorage (which is lost on browser close)
    // but keep the Kratos session cookie (which is persistent)
    await page.evaluate(() => sessionStorage.removeItem("kratos:sessionActive"));
    await page.reload();

    // Should be redirected to login because remember me was not checked
    await expect(page).toHaveURL("/login");
  });

  test("login with remember me persists across browser sessions", async ({ page }) => {
    const email = `remember-me-${Date.now()}@sunbeam.pt`;
    const password = "xK9#mQ2$pL7@vN4&wR1!";
    await createAuthenticatedIdentity(email, password);
    await sqliteDelay();

    await page.goto("/login");
    await page.getByLabel(/Username or email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByText("Remember me").click();
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page).toHaveURL("/");

    // Simulate a new browser session: clear sessionStorage but keep cookies
    await page.evaluate(() => sessionStorage.removeItem("kratos:sessionActive"));
    await page.reload();

    // Should still be logged in because remember me was checked
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Sunbeam SSO" })).toBeVisible();
  });

  // TODO: MFA login with TOTP
  // Kratos is not currently configured to require AAL2 on the login flow,
  // so enrolling TOTP in settings does not automatically trigger MFA during
  // sign-in. To test this end-to-end we would need to either:
  //   1. Configure Kratos login hooks to require AAL2, or
  //   2. Update the login page to create flows with ?aal=aal2 when needed.
  //
  // test("MFA login with TOTP", async ({ page }) => {
  //   const email = `mfa-totp-${Date.now()}@sunbeam.pt`;
  //   const password = "xK9#mQ2$pL7@vN4&wR1!";
  //   await createAuthenticatedIdentity(email, password);
  //   await sqliteDelay();
  //
  //   // Log in via UI to get a browser session
  //   await page.goto("/login");
  //   await page.getByLabel(/Username or email/i).fill(email);
  //   await page.getByLabel(/Password/i).fill(password);
  //   await page.getByRole("button", { name: /SIGN IN/i }).click();
  //   await expect(page).toHaveURL("/");
  //
  //   // Enroll TOTP via settings API
  //   const secret = await enrollTotpViaAPI(page);
  //   expect(secret).toBeTruthy();
  //
  //   // Log out
  //   await page.getByLabel("User menu").click();
  //   await page.getByRole("menuitem", { name: /Log out/i }).click();
  //   await expect(page).toHaveURL("/login");
  //
  //   // Log in again — should prompt for MFA
  //   await page.goto("/login");
  //   await page.getByLabel(/Username or email/i).fill(email);
  //   await page.getByLabel(/Password/i).fill(password);
  //   await page.getByRole("button", { name: /SIGN IN/i }).click();
  //
  //   await expect(
  //     page.getByRole("heading", { name: "Two-Factor Authentication" }),
  //   ).toBeVisible({ timeout: 10_000 });
  //
  //   const totpCode = await generateTOTP(secret);
  //   await page.locator("input").first().fill(totpCode);
  //   await page.getByRole("button", { name: /Verify/i }).click();
  //
  //   await expect(page).toHaveURL("/", { timeout: 10_000 });
  //   await expect(page.getByRole("link", { name: "Sunbeam SSO" })).toBeVisible();
  // });
});

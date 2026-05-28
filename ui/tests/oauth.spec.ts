import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers/mock-api";
import {
  consentRequest,
  loginRequest,
  logoutRequest,
  acceptResponse,
} from "./fixtures/hydra";

// ---------------------------------------------------------------------------
// ConsentPage  /oauth2/consent?consent_challenge=consent-challenge-test
// ---------------------------------------------------------------------------
test.describe("ConsentPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/hydra/consent", method: "GET", body: consentRequest },
      { match: "/api/hydra/consent/accept", method: "POST", status: 200, body: acceptResponse },
      { match: "/api/hydra/consent/reject", method: "POST", status: 200, body: acceptResponse },
    ]);
  });

  test("renders client name, subject, scope rows with checkboxes, remember checkbox, Deny and Allow buttons", async ({ page }) => {
    await page.goto("/oauth2/consent?consent_challenge=consent-challenge-test");

    // Heading includes client name
    await expect(page.getByRole("heading", { name: /allow sol studio to access your account/i })).toBeVisible();

    // Subject (UUID from fixture)
    await expect(page.getByText(/8e9105a2-58a0-4b1c-9d33-7e6a2ab44f10/)).toBeVisible();

    // Scope rows — consentRequest has: profile, email, projects:read, projects:write, offline_access
    // Use exact: true to avoid matching the description text alongside the scope name
    await expect(page.getByText("profile", { exact: true })).toBeVisible();
    await expect(page.getByText("email", { exact: true })).toBeVisible();
    await expect(page.getByText("projects:read", { exact: true })).toBeVisible();
    await expect(page.getByText("projects:write", { exact: true })).toBeVisible();
    await expect(page.getByText("offline_access", { exact: true })).toBeVisible();

    // Remember my decision checkbox label
    await expect(page.getByText(/remember my decision/i)).toBeVisible();

    // Action buttons
    await expect(page.getByRole("button", { name: /^deny$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^allow$/i })).toBeVisible();
  });

  test("clicking Allow POSTs to /api/hydra/consent/accept", async ({ page }) => {
    await page.goto("/oauth2/consent?consent_challenge=consent-challenge-test");

    // Wait for scopes to render
    await expect(page.getByText("profile")).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/consent/accept") && req.method() === "POST"),
      page.getByRole("button", { name: /^allow$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.challenge).toBe("consent-challenge-test");
    expect(Array.isArray(body.grant_scope)).toBe(true);
    // All 5 scopes should be granted (all start checked)
    expect(body.grant_scope).toContain("profile");
    expect(body.grant_scope).toContain("email");
    expect(body.grant_scope).toContain("projects:read");
  });

  test("unchecking a scope excludes it from the Allow POST", async ({ page }) => {
    await page.goto("/oauth2/consent?consent_challenge=consent-challenge-test");

    // Wait for scopes to render
    await expect(page.getByText("projects:write")).toBeVisible();

    // beam-ui Checkbox renders a visually-hidden native input + decorative div.
    // Aria-name isn't bound (label sits in a sibling) so role/name selectors
    // don't reach it. Index by fixture order: profile, email, projects:read,
    // projects:write (idx 3), offline_access. Force-click the input to bypass
    // the decorative pointer-blocking overlay.
    const projectsWriteCheckbox = page.locator('input[type="checkbox"]').nth(3);
    await projectsWriteCheckbox.uncheck({ force: true });

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/consent/accept") && req.method() === "POST"),
      page.getByRole("button", { name: /^allow$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.grant_scope).not.toContain("projects:write");
    expect(body.grant_scope).toContain("profile");
  });

  test("clicking Deny POSTs to /api/hydra/consent/reject with access_denied error", async ({ page }) => {
    await page.goto("/oauth2/consent?consent_challenge=consent-challenge-test");

    // Wait for page to load
    await expect(page.getByRole("button", { name: /^deny$/i })).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/consent/reject") && req.method() === "POST"),
      page.getByRole("button", { name: /^deny$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.challenge).toBe("consent-challenge-test");
    expect(body.error).toBe("access_denied");
  });

  test("remember my decision checkbox is unchecked by default", async ({ page }) => {
    await page.goto("/oauth2/consent?consent_challenge=consent-challenge-test");
    await expect(page.getByText(/remember my decision/i)).toBeVisible();

    // The remember checkbox is a standalone Checkbox with a label
    // Allow POST should send remember: false
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/consent/accept") && req.method() === "POST"),
      page.getByRole("button", { name: /^allow$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.remember).toBe(false);
    expect(body.remember_for).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OAuthLoginPage  /oauth2/login?login_challenge=login-challenge-test
// ---------------------------------------------------------------------------
test.describe("OAuthLoginPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/hydra/login", method: "GET", body: loginRequest },
      { match: "/api/hydra/login/accept", method: "POST", status: 200, body: acceptResponse },
    ]);
  });

  test("renders sign in heading, client name, email and password inputs, sign in button", async ({ page }) => {
    await page.goto("/oauth2/login?login_challenge=login-challenge-test");

    await expect(page.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
    // Client name from loginRequest fixture: "Marathon CLI"
    await expect(page.getByText(/marathon cli/i)).toBeVisible();

    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    // Password input — locate by label
    await expect(page.getByRole("textbox", { name: /password/i }).or(page.locator('input[type="password"]'))).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("sign in button is disabled until both email and password are filled", async ({ page }) => {
    await page.goto("/oauth2/login?login_challenge=login-challenge-test");
    const btn = page.getByRole("button", { name: /^sign in$/i });
    await expect(btn).toBeDisabled();

    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await expect(btn).toBeDisabled();

    await page.locator('input[type="password"]').fill("hunter2");
    await expect(btn).toBeEnabled();
  });

  test("submitting fires POST to /api/hydra/login/accept with subject and challenge", async ({ page }) => {
    await page.goto("/oauth2/login?login_challenge=login-challenge-test");
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await page.locator('input[type="password"]').fill("hunter2");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/login/accept") && req.method() === "POST"),
      page.getByRole("button", { name: /^sign in$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.challenge).toBe("login-challenge-test");
    expect(body.subject).toBe("test@studio.pt");
  });

  test("forgot password link points to /auth/recovery", async ({ page }) => {
    await page.goto("/oauth2/login?login_challenge=login-challenge-test");
    const link = page.getByRole("link", { name: /forgot password/i });
    await expect(link).toHaveAttribute("href", "/auth/recovery");
  });
});

// ---------------------------------------------------------------------------
// DeviceFlowPage  /oauth2/device
// ---------------------------------------------------------------------------
test.describe("DeviceFlowPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/oauth2/device/verify", method: "POST", status: 200, body: {} },
    ]);
  });

  test("renders DEVICE FLOW badge, Activate Marathon CLI heading, code input, Activate button", async ({ page }) => {
    await page.goto("/oauth2/device");

    await expect(page.getByText("DEVICE FLOW")).toBeVisible();
    await expect(page.getByRole("heading", { name: /activate marathon cli/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /device code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^activate$/i })).toBeVisible();
    // Format hint
    await expect(page.getByText(/xxxx-xxxx/i)).toBeVisible();
  });

  test("activate button is disabled until code is entered", async ({ page }) => {
    await page.goto("/oauth2/device");
    const btn = page.getByRole("button", { name: /^activate$/i });
    await expect(btn).toBeDisabled();
    await page.getByRole("textbox", { name: /device code/i }).fill("ABCD-1234");
    await expect(btn).toBeEnabled();
  });

  test("lowercase input is uppercased in the field", async ({ page }) => {
    await page.goto("/oauth2/device");
    const input = page.getByRole("textbox", { name: /device code/i });
    await input.fill("abcd-1234");
    await expect(input).toHaveValue("ABCD-1234");
  });

  test("submitting fires POST to /api/oauth2/device/verify with user_code", async ({ page }) => {
    await page.goto("/oauth2/device");
    await page.getByRole("textbox", { name: /device code/i }).fill("ABCD-1234");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/oauth2/device/verify") && req.method() === "POST"),
      page.getByRole("button", { name: /^activate$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.user_code).toBe("ABCD-1234");
  });

  test("success callout appears after successful activation", async ({ page }) => {
    await page.goto("/oauth2/device");
    await page.getByRole("textbox", { name: /device code/i }).fill("ABCD-1234");
    await page.getByRole("button", { name: /^activate$/i }).click();

    await expect(page.getByText(/device activated successfully/i)).toBeVisible();
    // Form is replaced by success callout — Activate button should be gone
    await expect(page.getByRole("button", { name: /^activate$/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// PostLogoutPage  /oauth2/sessions/logout?logout_challenge=logout-challenge-test
// ---------------------------------------------------------------------------
test.describe("PostLogoutPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/hydra/logout", method: "GET", body: logoutRequest },
      { match: "/api/hydra/logout/accept", method: "POST", status: 200, body: acceptResponse },
      { match: "/api/hydra/logout/reject", method: "POST", status: 200, body: {} },
    ]);
  });

  test("renders Sign out of Sol Studio heading and both action buttons", async ({ page }) => {
    await page.goto("/oauth2/sessions/logout?logout_challenge=logout-challenge-test");

    // The heading text contains "Sol Studio" in an orange span — getByRole matches combined text
    await expect(page.getByRole("heading", { name: /sign out of sol studio/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign out$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /no, stay signed in/i })).toBeVisible();
  });

  test("clicking Sign out POSTs to /api/hydra/logout/accept with challenge", async ({ page }) => {
    await page.goto("/oauth2/sessions/logout?logout_challenge=logout-challenge-test");
    await expect(page.getByRole("button", { name: /^sign out$/i })).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/logout/accept") && req.method() === "POST"),
      page.getByRole("button", { name: /^sign out$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.challenge).toBe("logout-challenge-test");
  });

  test("clicking No, stay signed in POSTs to /api/hydra/logout/reject", async ({ page }) => {
    await page.goto("/oauth2/sessions/logout?logout_challenge=logout-challenge-test");
    await expect(page.getByRole("button", { name: /no, stay signed in/i })).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/logout/reject") && req.method() === "POST"),
      page.getByRole("button", { name: /no, stay signed in/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.challenge).toBe("logout-challenge-test");
  });
});

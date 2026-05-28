import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers/mock-api";
import {
  loginFlow,
  loginFlowWithError,
  registrationFlow,
  recoveryFlow,
  recoveryFlowSent,
  verificationFlow,
  flowExpired,
  flowError500,
  flowError404,
} from "./fixtures/flows";

// ---------------------------------------------------------------------------
// LoginPage  /auth/login?flow=login-flow-test-id
// ---------------------------------------------------------------------------
test.describe("LoginPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/login", method: "GET", body: loginFlow },
    ]);
  });

  test("renders heading, email input, continue button and social tiles", async ({ page }) => {
    await page.goto("/auth/login?flow=login-flow-test-id");

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^continue →$/i })).toBeVisible();

    // Social method tiles (role="button" divs)
    await expect(page.getByRole("button", { name: /continue with passkey/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /saml sso/i })).toBeVisible();
  });

  test("continue button is disabled until email is entered", async ({ page }) => {
    await page.goto("/auth/login?flow=login-flow-test-id");
    const btn = page.getByRole("button", { name: /^continue →$/i });
    await expect(btn).toBeDisabled();
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await expect(btn).toBeEnabled();
  });

  test("submitting email fires POST to flow action url", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/login", method: "GET", body: loginFlow },
      { match: "/api/flow/login", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/login?flow=login-flow-test-id");
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/login") && req.method() === "POST"),
      page.getByRole("button", { name: /^continue →$/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.identifier).toBe("test@studio.pt");
    expect(body.method).toBe("password");
  });

  test("flow-level error messages render as warning Callout", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/login", method: "GET", body: loginFlowWithError },
    ]);
    await page.goto("/auth/login?flow=login-flow-error");

    await expect(page.getByText(/the provided credentials are invalid/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// LoginCodePage  /auth/login/code
// ---------------------------------------------------------------------------
test.describe("LoginCodePage", () => {
  test("renders inbox heading, PinInput, verify button and countdown", async ({ page }) => {
    // No API mock needed — page is self-contained (no flow fetch)
    await mockApi(page, []);
    await page.goto("/auth/login/code");

    await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /verify code/i })).toBeVisible();
    // Initial countdown text starts at 0:42
    await expect(page.getByText(/resend in 0:42/i)).toBeVisible();
  });

  test("verify button is disabled until 6 digits are entered", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/auth/login/code");
    const btn = page.getByRole("button", { name: /verify code/i });
    await expect(btn).toBeDisabled();

    // PinInput renders individual numeric inputs; fill each one
    const inputs = page.locator('input[inputmode="numeric"]');
    const count = await inputs.count();
    if (count === 6) {
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).fill(String(i + 1));
      }
      await expect(btn).toBeEnabled();
    } else {
      // TODO: tighten selector — PinInput may render differently
      // Attempt to fill via keyboard into first input
      await inputs.first().focus();
      await page.keyboard.type("123456");
      await expect(btn).toBeEnabled();
    }
  });

  test("submitting fires POST to flow action with code and method", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/login", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/login/code?flow=login-flow-test-id");

    // Fill all 6 digits
    const inputs = page.locator('input[inputmode="numeric"]');
    const count = await inputs.count();
    if (count === 6) {
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).fill(String(i + 1));
      }
    } else {
      // TODO: tighten selector
      await inputs.first().focus();
      await page.keyboard.type("123456");
    }

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/login") && req.method() === "POST"),
      page.getByRole("button", { name: /verify code/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.method).toBe("code");
  });
});

// ---------------------------------------------------------------------------
// LoginMfaPage  /auth/login/mfa?flow=login-flow-test-id
// ---------------------------------------------------------------------------
test.describe("LoginMfaPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/login", method: "GET", body: loginFlow },
    ]);
  });

  test("renders AAL2 badge, second factor heading, and 4 method tiles", async ({ page }) => {
    await page.goto("/auth/login/mfa?flow=login-flow-test-id");

    await expect(page.getByText("AAL2 REQUIRED")).toBeVisible();
    await expect(page.getByRole("heading", { name: /second factor/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /passkey/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /authenticator app/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /backup code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
  });

  test("recover account link points to /auth/recovery", async ({ page }) => {
    await page.goto("/auth/login/mfa?flow=login-flow-test-id");
    const link = page.getByRole("link", { name: /recover account/i });
    await expect(link).toHaveAttribute("href", "/auth/recovery");
  });
});

// ---------------------------------------------------------------------------
// RegistrationPage  /auth/register?flow=registration-flow-test-id
// ---------------------------------------------------------------------------
test.describe("RegistrationPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
    ]);
  });

  test("renders RECOMMENDED badge, passkey heading, email + display name inputs, primary + ghost buttons, 4 social tiles", async ({ page }) => {
    await page.goto("/auth/register?flow=registration-flow-test-id");

    await expect(page.getByText("RECOMMENDED")).toBeVisible();
    await expect(page.getByRole("heading", { name: /register with a passkey/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /display name/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create passkey/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /use password/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with microsoft/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with apple/i })).toBeVisible();
  });

  test("create passkey button is disabled until email is filled", async ({ page }) => {
    await page.goto("/auth/register?flow=registration-flow-test-id");
    const btn = page.getByRole("button", { name: /create passkey/i });
    await expect(btn).toBeDisabled();
    await page.getByRole("textbox", { name: /email/i }).fill("new@studio.pt");
    await expect(btn).toBeEnabled();
  });

  test("submitting passkey form fires POST with passkey method", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
      { match: "/api/flow/registration", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/register?flow=registration-flow-test-id");
    await page.getByRole("textbox", { name: /email/i }).fill("new@studio.pt");
    await page.getByRole("textbox", { name: /display name/i }).fill("New User");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/registration") && req.method() === "POST"),
      page.getByRole("button", { name: /create passkey/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.method).toBe("passkey");
    expect(body["traits.email"]).toBe("new@studio.pt");
  });
});

// ---------------------------------------------------------------------------
// RegistrationInvitePage  /auth/register/invite?invite=tok_xxx
// ---------------------------------------------------------------------------
test.describe("RegistrationInvitePage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
    ]);
  });

  test("renders ORG INVITE badge, Join Studio Corp heading, pre-filled email, SAML note, Continue button", async ({ page }) => {
    await page.goto("/auth/register/invite?invite=tok_xxx&flow=registration-flow-test-id");

    await expect(page.getByText("ORG INVITE")).toBeVisible();
    await expect(page.getByRole("heading", { name: /join studio corp/i })).toBeVisible();

    // Email is pre-filled to joana@studiocorp.pt
    const emailInput = page.getByRole("textbox", { name: /work email/i });
    await expect(emailInput).toHaveValue("joana@studiocorp.pt");

    await expect(page.getByText(/saml enforced/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with studio sso/i })).toBeVisible();
  });

  test("submitting invite form fires POST with saml method and invite token", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
      { match: "/api/flow/registration", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/register/invite?invite=tok_xxx&flow=registration-flow-test-id");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/registration") && req.method() === "POST"),
      page.getByRole("button", { name: /continue with studio sso/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.method).toBe("saml");
    expect(body.invite_token).toBe("tok_xxx");
  });
});

// ---------------------------------------------------------------------------
// RegistrationSocialConfirmPage  /auth/register/confirm?flow=registration-flow-test-id
// ---------------------------------------------------------------------------
test.describe("RegistrationSocialConfirmPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
    ]);
  });

  test("renders FROM GOOGLE badge, Confirm your details heading, disabled email, locale select, terms checkbox, create account button", async ({ page }) => {
    await page.goto("/auth/register/confirm?flow=registration-flow-test-id");

    await expect(page.getByText("FROM GOOGLE").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /confirm your details/i })).toBeVisible();

    // Email field should be disabled (pre-filled from Google)
    const emailInput = page.getByRole("textbox", { name: /email \(from google\)/i });
    await expect(emailInput).toBeDisabled();

    // Locale select visible
    await expect(page.getByText(/locale/i)).toBeVisible();

    // Terms checkbox
    await expect(page.getByText(/i agree to the terms/i)).toBeVisible();

    // Create account button starts disabled (terms unchecked)
    const createBtn = page.getByRole("button", { name: /create account/i });
    await expect(createBtn).toBeDisabled();
  });

  test("create account button enables after agreeing to terms", async ({ page }) => {
    await page.goto("/auth/register/confirm?flow=registration-flow-test-id");
    const createBtn = page.getByRole("button", { name: /create account/i });
    await expect(createBtn).toBeDisabled();

    // Click the terms checkbox label
    await page.getByText(/i agree to the terms/i).click();
    await expect(createBtn).toBeEnabled();
  });

  test("submitting fires POST with oidc method", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/registration", method: "GET", body: registrationFlow },
      { match: "/api/flow/registration", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/register/confirm?flow=registration-flow-test-id");
    await page.getByText(/i agree to the terms/i).click();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/registration") && req.method() === "POST"),
      page.getByRole("button", { name: /create account/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.method).toBe("oidc");
  });
});

// ---------------------------------------------------------------------------
// RecoveryPage  /auth/recovery?flow=recovery-flow-test-id
// ---------------------------------------------------------------------------
test.describe("RecoveryPage", () => {
  test("idle state: renders heading, email input, send recovery code button", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/recovery", method: "GET", body: recoveryFlow },
    ]);
    await page.goto("/auth/recovery?flow=recovery-flow-test-id");

    await expect(page.getByRole("heading", { name: /recover your account/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send recovery code/i })).toBeVisible();
  });

  test("send recovery code button is disabled until email is entered", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/recovery", method: "GET", body: recoveryFlow },
    ]);
    await page.goto("/auth/recovery?flow=recovery-flow-test-id");
    await expect(page.getByRole("button", { name: /send recovery code/i })).toBeDisabled();
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await expect(page.getByRole("button", { name: /send recovery code/i })).toBeEnabled();
  });

  test("sent state: success callout appears after successful POST", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/recovery", method: "GET", body: recoveryFlow },
      { match: "/api/flow/recovery", method: "POST", status: 200, body: recoveryFlowSent },
    ]);
    await page.goto("/auth/recovery?flow=recovery-flow-test-id");
    await page.getByRole("textbox", { name: /email/i }).fill("test@studio.pt");
    await page.getByRole("button", { name: /send recovery code/i }).click();

    // After POST succeeds, the sent callout should appear with the email address
    await expect(page.getByText(/check your inbox/i)).toBeVisible();
    await expect(page.getByText(/test@studio\.pt/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// VerificationPage  /auth/verify?flow=verification-flow-test-id
// ---------------------------------------------------------------------------
test.describe("VerificationPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/verification", method: "GET", body: verificationFlow },
    ]);
  });

  test("renders check icon, verify your email heading, resend and use different address buttons", async ({ page }) => {
    await page.goto("/auth/verify?flow=verification-flow-test-id");

    await expect(page.getByText("✓")).toBeVisible();
    await expect(page.getByRole("heading", { name: /verify your email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /resend email/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /use a different address/i })).toBeVisible();
  });

  test("resend email fires POST to flow action", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/verification", method: "GET", body: verificationFlow },
      { match: "/api/flow/verification", method: "POST", status: 200, body: {} },
    ]);
    await page.goto("/auth/verify?flow=verification-flow-test-id");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/flow/verification") && req.method() === "POST"),
      page.getByRole("button", { name: /resend email/i }).click(),
    ]);

    const body = JSON.parse(request.postData() ?? "{}");
    expect(body.method).toBe("link");
    expect(body.resend).toBe("link");
  });
});

// ---------------------------------------------------------------------------
// FlowExpiredPage  /auth/expired?flow=expired-flow-id
// (no API fetch — reads flow_id from URL param directly)
// ---------------------------------------------------------------------------
test.describe("FlowExpiredPage", () => {
  test("renders expired heading, flow_id monospaced, start over button", async ({ page }) => {
    // No API mock needed — this page reads the URL param only
    await mockApi(page, []);
    await page.goto("/auth/expired?flow=expired-flow-id");

    await expect(page.getByRole("heading", { name: /this flow has expired/i })).toBeVisible();
    // flow_id displayed monospaced
    await expect(page.getByText(/flow_id: expired-flow-id/)).toBeVisible();
    await expect(page.getByRole("button", { name: /start over/i })).toBeVisible();
  });

  test("start over navigates to /auth/login", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/auth/expired?flow=expired-flow-id");

    await Promise.all([
      page.waitForURL(/\/auth\/login/),
      page.getByRole("button", { name: /start over/i }).click(),
    ]);
  });
});

// ---------------------------------------------------------------------------
// LogoutPage  /auth/logout
// ---------------------------------------------------------------------------
test.describe("LogoutPage", () => {
  test.beforeEach(async ({ page }) => {
    // No flow fetch needed when no flow param or token — page renders immediately
    await mockApi(page, [
      { match: "/api/hydra/logout/accept", method: "POST", status: 200, body: {} },
    ]);
  });

  test("renders sign out heading and both buttons", async ({ page }) => {
    await page.goto("/auth/logout");

    await expect(page.getByRole("heading", { name: /sign out\?/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign out$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^cancel$/i })).toBeVisible();
  });

  test("clicking sign out fires POST to /api/hydra/logout/accept", async ({ page }) => {
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/hydra/logout/accept") && req.method() === "POST"),
      (async () => {
        await page.goto("/auth/logout");
        await page.getByRole("button", { name: /^sign out$/i }).click();
      })(),
    ]);

    expect(request.method()).toBe("POST");
  });
});

// ---------------------------------------------------------------------------
// ErrorPage  /auth/error?id=error-id-500
// ---------------------------------------------------------------------------
test.describe("ErrorPage", () => {
  test("HTTP 500 variant: renders Something went wrong, HTTP 500 badge, monospace req-id", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/error", method: "GET", body: flowError500 },
    ]);
    await page.goto("/auth/error?id=error-id-500");

    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
    // Badge text: "HTTP 500 · INTERNAL_ERROR"
    await expect(page.getByText(/http 500/i)).toBeVisible();
    // Monospaced req-id
    await expect(page.getByText(/req: error-id-500/)).toBeVisible();
  });

  test("HTTP 404 variant: renders HTTP 404 badge and correct req-id", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/error", method: "GET", body: flowError404 },
    ]);
    await page.goto("/auth/error?id=error-id-404");

    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
    await expect(page.getByText(/http 404/i)).toBeVisible();
    await expect(page.getByText(/req: error-id-404/)).toBeVisible();
  });

  test("try again button and contact support link are visible", async ({ page }) => {
    await mockApi(page, [
      { match: "/api/flow/error", method: "GET", body: flowError500 },
    ]);
    await page.goto("/auth/error?id=error-id-500");

    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /contact support/i })).toBeVisible();
  });
});

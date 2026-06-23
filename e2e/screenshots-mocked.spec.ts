import { expect, type Page, test } from "@playwright/test";

const OUT = "e2e/screenshots";

const LOGIN_CHALLENGE = "12345678-1234-1234-1234-123456789abc";
const LOGOUT_CHALLENGE = "12345678-1234-1234-1234-123456789abd";
const CONSENT_CHALLENGE = "12345678-1234-1234-1234-123456789abe";

function apiResponse(body: unknown, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function mockFlowAction(path: string, flowId: string) {
  return `http://localhost:4433${path}?flow=${flowId}`;
}

async function mockAnonymousSession(page: Page) {
  await page.route("/api/sessions/whoami", async (route) => {
    await route.fulfill(
      apiResponse(
        { error: { id: "session_inactive", status: "Unauthorized" } },
        401,
      ),
    );
  });
}

function buildLoginFlow(flowId: string, action: string) {
  return {
    id: flowId,
    type: "login",
    ui: {
      action,
      method: "POST",
      nodes: [
        {
          type: "input",
          group: "default",
          attributes: { name: "csrf_token", type: "hidden", value: "csrf" },
        },
        {
          type: "input",
          group: "default",
          attributes: { name: "identifier", type: "email", value: "" },
        },
        {
          type: "input",
          group: "default",
          attributes: { name: "password", type: "password", value: "" },
        },
        {
          type: "input",
          group: "password",
          attributes: { name: "method", type: "submit", value: "password" },
        },
        {
          type: "input",
          group: "oidc",
          attributes: {
            name: "provider",
            type: "submit",
            value: "discord",
          },
          meta: { label: { text: "Sign in with Discord", type: "info" } },
        },
        {
          type: "input",
          group: "oidc",
          attributes: {
            name: "provider",
            type: "submit",
            value: "github",
          },
          meta: { label: { text: "Sign in with GitHub", type: "info" } },
        },
      ],
      messages: [],
    },
  };
}

async function mockLoginFlow(page: Page) {
  const flowId = "login-flow-screenshot";
  const action = mockFlowAction("/self-service/login", flowId);

  await page.route(/\/api\/self-service\/login(\?.*)?$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const postBody = route.request().postDataJSON();
    if (postBody?.method === "password") {
      if (postBody.identifier === "mfa@sunbeam.pt") {
        return route.fulfill(apiResponse({
          id: flowId,
          type: "login",
          requested_aal: "aal2",
          ui: {
            action,
            method: "POST",
            nodes: [
              {
                type: "input",
                group: "default",
                attributes: {
                  name: "csrf_token",
                  type: "hidden",
                  value: "csrf",
                },
              },
              {
                type: "input",
                group: "totp",
                attributes: { name: "method", type: "submit", value: "totp" },
              },
              {
                type: "input",
                group: "lookup_secret",
                attributes: {
                  name: "method",
                  type: "submit",
                  value: "lookup_secret",
                },
              },
            ],
            messages: [],
          },
        }));
      }
      if (postBody.identifier === "error@sunbeam.pt") {
        return route.fulfill(apiResponse({
          id: flowId,
          type: "login",
          ui: {
            action,
            method: "POST",
            nodes: [
              {
                type: "input",
                group: "default",
                attributes: {
                  name: "csrf_token",
                  type: "hidden",
                  value: "csrf",
                },
              },
              {
                type: "input",
                group: "default",
                attributes: {
                  name: "identifier",
                  type: "email",
                  value: postBody.identifier,
                },
              },
              {
                type: "input",
                group: "default",
                attributes: { name: "password", type: "password", value: "" },
              },
            ],
            messages: [{
              type: "error",
              text:
                "The provided credentials are invalid. Check for spelling mistakes in your password or username, email address, or phone number.",
              id: 4000006,
            }],
          },
        }, 400));
      }
      return route.fulfill(apiResponse({
        session: {
          active: true,
          identity: { id: "user-1", traits: { email: postBody.identifier } },
          authenticator_assurance_level: "aal1",
        },
      }));
    }

    if (postBody?.method === "totp" || postBody?.method === "lookup_secret") {
      return route.fulfill(apiResponse({
        session: {
          active: true,
          identity: { id: "user-1", traits: { email: "mfa@sunbeam.pt" } },
          authenticator_assurance_level: "aal2",
        },
      }));
    }

    await route.continue();
  });

  await page.route(/\/api\/self-service\/login\/flows(\?.*)?$/, async (route) => {
    await route.fulfill(apiResponse(buildLoginFlow(flowId, action)));
  });

  await page.route("/api/self-service/login/browser", async (route) => {
    await route.fulfill(apiResponse(buildLoginFlow(flowId, action)));
  });
}

function buildRecoveryFlow(flowId: string, action: string) {
  return {
    id: flowId,
    type: "recovery",
    state: "choose_method",
    ui: {
      action,
      method: "POST",
      nodes: [
        {
          type: "input",
          group: "default",
          attributes: { name: "csrf_token", type: "hidden", value: "csrf" },
        },
        {
          type: "input",
          group: "code",
          attributes: { name: "email", type: "email", value: "" },
        },
        {
          type: "input",
          group: "code",
          attributes: { name: "method", type: "submit", value: "code" },
        },
      ],
      messages: [],
    },
  };
}

async function mockRecoveryFlow(page: Page) {
  const flowId = "recovery-flow-screenshot";
  const action = mockFlowAction("/self-service/recovery", flowId);

  await page.route(/\/api\/self-service\/recovery(\?.*)?$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const postBody = route.request().postDataJSON();
    if (postBody?.method === "code" && postBody.email) {
      return route.fulfill(apiResponse({
        id: flowId,
        type: "recovery",
        state: "sent_email",
        ui: {
          action,
          method: "POST",
          nodes: [
            {
              type: "input",
              group: "default",
              attributes: { name: "csrf_token", type: "hidden", value: "csrf" },
            },
            {
              type: "input",
              group: "code",
              attributes: { name: "code", type: "text", value: "" },
            },
          ],
          messages: [{
            type: "info",
            text:
              "An email containing a recovery code has been sent to the email address you provided.",
            id: 1060003,
          }],
        },
      }));
    }

    if (postBody?.method === "code" && postBody.code) {
      return route.fulfill(apiResponse({
        id: flowId,
        type: "recovery",
        state: "passed_challenge",
        ui: {
          action,
          method: "POST",
          nodes: [
            {
              type: "input",
              group: "default",
              attributes: { name: "csrf_token", type: "hidden", value: "csrf" },
            },
          ],
          messages: [{
            type: "info",
            text: "You successfully recovered your account.",
            id: 1060001,
          }],
        },
      }));
    }

    await route.continue();
  });

  await page.route(/\/api\/self-service\/recovery\/flows(\?.*)?$/, async (route) => {
    await route.fulfill(apiResponse(buildRecoveryFlow(flowId, action)));
  });

  await page.route("/api/self-service/recovery/browser", async (route) => {
    await route.fulfill(apiResponse(buildRecoveryFlow(flowId, action)));
  });
}

async function mockHydraLogin(page: Page) {
  await page.route(
    `/api/hydra/login?challenge=${LOGIN_CHALLENGE}`,
    async (route) => {
      await route.fulfill(apiResponse({
        challenge: LOGIN_CHALLENGE,
        client: { client_name: "Example App" },
        subject: "",
        skip: false,
      }));
    },
  );

  await page.route("/api/hydra/login/accept", async (route) => {
    await route.fulfill(
      apiResponse({
        redirect_to: "http://localhost:47823/auth/callback?code=abc",
      }),
    );
  });
}

async function mockHydraLogout(page: Page) {
  await page.route(
    `/api/hydra/logout?challenge=${LOGOUT_CHALLENGE}`,
    async (route) => {
      await route.fulfill(apiResponse({
        challenge: LOGOUT_CHALLENGE,
        subject: "user-1",
        sid: "session-1",
        rp_initiated: true,
      }));
    },
  );

  await page.route("/api/hydra/logout/accept", async (route) => {
    await route.fulfill(
      apiResponse({ redirect_to: "http://localhost:3102/login" }),
    );
  });
}

async function mockHydraConsent(page: Page) {
  await page.route(
    `/api/hydra/consent?challenge=${CONSENT_CHALLENGE}`,
    async (route) => {
      await route.fulfill(apiResponse({
        challenge: CONSENT_CHALLENGE,
        client: { client_name: "Example App" },
        subject: "user-1",
        requested_scope: ["openid", "email", "profile", "offline_access"],
        requested_access_token_audience: [],
        skip: false,
      }));
    },
  );

  await page.route("/api/hydra/consent/accept", async (route) => {
    await route.fulfill(
      apiResponse({
        redirect_to: "http://localhost:47823/auth/callback?code=abc",
      }),
    );
  });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("Mocked page state screenshots", () => {
  test("/login password form", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockLoginFlow(page);
    await page.goto("/login");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await page.screenshot({
      path: `${OUT}/login-password.png`,
      fullPage: true,
    });
  });

  test("/login error state", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockLoginFlow(page);
    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill("error@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("wrong");
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByText(/credentials are invalid/i).first())
      .toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/login-error.png`, fullPage: true });
  });

  test("/login MFA state", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockLoginFlow(page);
    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill("mfa@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("password");
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(
      page.getByRole("heading", { name: "Two-Factor Authentication" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/login-mfa.png`, fullPage: true });
  });

  test("/login authenticated state", async ({ page }) => {
    await page.route("/api/sessions/whoami", async (route) => {
      await route.fulfill(apiResponse({
        active: true,
        identity: { id: "user-1", traits: { email: "user@sunbeam.pt" } },
        authenticator_assurance_level: "aal1",
      }));
    });
    await mockLoginFlow(page);
    await page.goto("/login");
    await page.getByLabel(/Username or Email/i).fill("user@sunbeam.pt");
    await page.getByLabel(/Password/i).fill("password");
    await page.getByRole("button", { name: /SIGN IN/i }).click();
    await expect(page.getByText(/Login successful/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({
      path: `${OUT}/login-authenticated.png`,
      fullPage: true,
    });
  });

  test("/recovery states", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockRecoveryFlow(page);
    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Reset your password" }))
      .toBeVisible();
    await page.screenshot({
      path: `${OUT}/recovery-email.png`,
      fullPage: true,
    });

    await page.getByLabel(/Email/i).fill("recovery@sunbeam.pt");
    await page.getByRole("button", { name: /Send Recovery Code/i }).click();
    await expect(page.getByText(/Enter the recovery code/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({
      path: `${OUT}/recovery-code.png`,
      fullPage: true,
    });

    await page.getByPlaceholder("000000").fill("123456");
    await page.getByRole("button", { name: /Verify Code/i }).click();
    await expect(page.getByRole("heading", { name: "Password reset" }))
      .toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${OUT}/recovery-success.png`,
      fullPage: true,
    });
  });

  test("/recovery error state", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockRecoveryFlow(page);

    const errorFlowId = "recovery-error-flow";
    const errorAction = mockFlowAction("/self-service/recovery", errorFlowId);
    await page.route(/\/api\/self-service\/recovery(\?.*)?$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const postBody = route.request().postDataJSON();
      if (
        postBody?.method === "code" &&
        postBody.email === "unknown@sunbeam.pt"
      ) {
        return route.fulfill(apiResponse({
          id: errorFlowId,
          type: "recovery",
          state: "choose_method",
          ui: {
            action: errorAction,
            method: "POST",
            nodes: [
              {
                type: "input",
                group: "default",
                attributes: {
                  name: "csrf_token",
                  type: "hidden",
                  value: "csrf",
                },
              },
              {
                type: "input",
                group: "code",
                attributes: { name: "email", type: "email", value: "" },
              },
            ],
            messages: [{
              type: "error",
              text:
                "You cannot recover this account because it does not exist.",
              id: 4000001,
            }],
          },
        }, 400));
      }
      await route.continue();
    });

    await page.goto("/recovery");
    await page.getByLabel(/Email/i).fill("unknown@sunbeam.pt");
    await page.getByRole("button", { name: /Send Recovery Code/i }).click();
    await expect(page.getByRole("alert")).toContainText(
      "You cannot recover this account because it does not exist.",
      { timeout: 10_000 },
    );
    await page.screenshot({
      path: `${OUT}/recovery-error.png`,
      fullPage: true,
    });
  });

  test("/login social sign-in buttons", async ({ page }) => {
    await mockAnonymousSession(page);
    await mockLoginFlow(page);
    await page.goto("/login");
    await settle(page);
    await expect(
      page.getByRole("button", { name: /Discord/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /GitHub/i }),
    ).toBeVisible();
    await page.screenshot({
      path: `${OUT}/login-social.png`,
      fullPage: true,
    });
  });

  test("/oauth/login state", async ({ page }) => {
    await mockHydraLogin(page);
    await page.goto(`/oauth/login?login_challenge=${LOGIN_CHALLENGE}`);
    await expect(page.getByRole("heading", { name: /Sign in to continue/i }))
      .toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/oauth-login.png`, fullPage: true });
  });

  test("/oauth/logged-out state", async ({ page }) => {
    await mockHydraLogout(page);
    await page.goto(`/oauth/logged-out?logout_challenge=${LOGOUT_CHALLENGE}`);
    await expect(page.getByRole("heading", { name: /Sign out of Sunbeam/i }))
      .toBeVisible();
    await page.screenshot({
      path: `${OUT}/oauth-logged-out.png`,
      fullPage: true,
    });
  });

  test("/consent state", async ({ page }) => {
    await mockHydraConsent(page);
    await page.goto(`/consent?consent_challenge=${CONSENT_CHALLENGE}`);
    await expect(page.getByRole("heading", { name: /Authorize Example App/i }))
      .toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/consent.png`, fullPage: true });
  });

  test("/error state", async ({ page }) => {
    await page.goto(
      "/error?error=access_denied&error_description=User+denied+access",
    );
    await expect(page.getByRole("heading", { name: "Something went wrong" }))
      .toBeVisible();
    await page.screenshot({ path: `${OUT}/error.png`, fullPage: true });
  });
});

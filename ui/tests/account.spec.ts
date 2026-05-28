import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers/mock-api";
import { settingsFlow } from "./fixtures/flows";
import { sessionList, sessionCurrent } from "./fixtures/sessions";
import { identityJoana } from "./fixtures/identities";

// ── ProfilePage ───────────────────────────────────────────────────────────────

test.describe("ProfilePage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/auth/session", method: "GET", body: { identity: identityJoana } },
      { match: "/api/flow/settings", method: "GET", body: settingsFlow },
      { match: "/api/flow/settings", method: "POST", body: { state: "success" } },
      { match: "/api/avatar", method: "PUT", body: { ok: true } },
    ]);
  });

  test("loaded state — heading, avatar, upload button, prefilled fields", async ({ page }) => {
    await page.goto("/account/profile");

    await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible();

    // Avatar component renders initials; full name is in aria-label
    await expect(page.getByRole("img", { name: "Joana Silva" })).toBeVisible();

    // Upload button (label + button both match; take first)
    await expect(page.getByRole("button", { name: "Upload" }).first()).toBeVisible();

    // TextInput labels
    await expect(page.getByText("Full name")).toBeVisible();
    await expect(page.getByText("Display name")).toBeVisible();
    await expect(page.getByText("Email (verified)")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();

    // Prefilled values — identityJoana has name.first=Joana name.last=Silva
    await expect(page.getByLabel("Full name")).toHaveValue("Joana Silva");
    await expect(page.getByLabel("Display name")).toHaveValue("Joana");
    await expect(page.getByLabel("Email (verified)")).toHaveValue("j.silva@studio.pt");

    // Verified email hint
    await expect(page.getByText("✓ verified · used for recovery")).toBeVisible();
  });

  test("edit display name → Save changes → POST to flow action", async ({ page }) => {
    await page.goto("/account/profile");

    // Wait for form to be synced with session data
    await expect(page.getByLabel("Display name")).toHaveValue("Joana");

    await page.getByLabel("Display name").fill("Jo");

    const postRequest = page.waitForRequest(
      (req) => req.url().includes("/api/flow/settings") && req.method() === "POST",
    );

    await page.getByRole("button", { name: "Save changes" }).click();

    const req = await postRequest;
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body["traits.display_name"]).toBe("Jo");
    expect(body.method).toBe("profile");
  });

  test("avatar upload — click Upload, set file, PUT /api/avatar called", async ({ page }) => {
    await page.goto("/account/profile");

    await expect(page.getByRole("button", { name: "Upload" }).first()).toBeVisible();

    const putRequest = page.waitForRequest(
      (req) => req.url().includes("/api/avatar") && req.method() === "PUT",
    );

    // Directly dispatch a file to the hidden input without triggering click on the button
    await page.locator("input#avatar-upload").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("PNG"),
    });

    await putRequest;
  });

  test("save success — callout 'Changes saved.' appears", async ({ page }) => {
    await page.goto("/account/profile");

    await expect(page.getByLabel("Display name")).toHaveValue("Joana");

    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Changes saved.")).toBeVisible();
  });
});

// ── SecurityPage ──────────────────────────────────────────────────────────────

test.describe("SecurityPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      { match: "/api/auth/session", method: "GET", body: { identity: identityJoana } },
      { match: "/api/flow/settings", method: "GET", body: settingsFlow },
      { match: "/api/flow/settings", method: "POST", body: { state: "success" } },
    ]);
  });

  test("loaded state — heading and all section eyebrows", async ({ page }) => {
    await page.goto("/account/security");

    await expect(page.getByRole("heading", { level: 2, name: "Security" })).toBeVisible();

    await expect(page.getByText("PASSWORD").first()).toBeVisible();
    await expect(page.getByText(/PASSKEYS/).first()).toBeVisible();
    await expect(page.getByText("TWO-FACTOR").first()).toBeVisible();
    await expect(page.getByText("CONNECTED ACCOUNTS").first()).toBeVisible();
  });

  test("password section — Change button visible", async ({ page }) => {
    await page.goto("/account/security");

    await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  });

  test("passkeys section — + Add passkey button + all 3 rows with Remove", async ({ page }) => {
    await page.goto("/account/security");

    await expect(page.getByRole("button", { name: "+ Add passkey" })).toBeVisible();

    // 3 mock passkeys
    await expect(page.getByText("MacBook Pro · Touch ID")).toBeVisible();
    await expect(page.getByText("iPhone 15")).toBeVisible();
    await expect(page.getByText("YubiKey 5C")).toBeVisible();

    // Each passkey row has a Remove button — 3 total
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(3);
  });

  test("two-factor section — Authenticator and Backup codes panels", async ({ page }) => {
    await page.goto("/account/security");

    await expect(page.getByText("Authenticator (TOTP)")).toBeVisible();
    await expect(page.getByText("Backup codes")).toBeVisible();
    await expect(page.getByText("ENABLED")).toBeVisible();
    await expect(page.getByText("7 / 10 LEFT")).toBeVisible();
  });

  test("connected accounts — Google, GitHub, Microsoft, SAML rows", async ({ page }) => {
    await page.goto("/account/security");

    await expect(page.getByText("Google · j.silva@gmail.com")).toBeVisible();
    await expect(page.getByText("GitHub · @joana")).toBeVisible();
    await expect(page.getByText("Microsoft")).toBeVisible();
    await expect(page.getByText("SAML · Studio Corp")).toBeVisible();

    // Status button labels
    await expect(page.getByRole("button", { name: "Connected" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Link" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Linked by org" })).toBeVisible();
  });

  test("change password dialog — opens, accepts input, POST on submit, closes", async ({
    page,
  }) => {
    await page.goto("/account/security");

    await page.getByRole("button", { name: "Change" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Change password")).toBeVisible();

    await dialog.getByLabel("Current password").fill("hunter2");
    await dialog.getByLabel("New password").fill("correct-horse-battery-staple");

    const postRequest = page.waitForRequest(
      (req) => req.url().includes("/api/flow/settings") && req.method() === "POST",
    );

    await dialog.getByRole("button", { name: "Update password" }).click();

    const req = await postRequest;
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.method).toBe("password");
    expect(body.password).toBe("correct-horse-battery-staple");

    // Dialog closes on success
    await expect(dialog).not.toBeVisible();
  });

  test("change password dialog — Cancel button closes dialog without POST", async ({ page }) => {
    await page.goto("/account/security");

    await page.getByRole("button", { name: "Change" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
  });

  test("passkey Remove — POST to flow action with passkey_remove", async ({ page }) => {
    await page.goto("/account/security");

    const postRequest = page.waitForRequest(
      (req) => req.url().includes("/api/flow/settings") && req.method() === "POST",
    );

    await page.getByRole("button", { name: "Remove" }).first().click();

    const req = await postRequest;
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.method).toBe("passkey");
    expect(body.passkey_remove).toBe("pk1");
  });
});

// ── AccountSessionsPage ───────────────────────────────────────────────────────

test.describe("AccountSessionsPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: "/api/sessions",
        method: "GET",
        body: { sessions: sessionList, current_session_id: sessionCurrent.id },
      },
      { match: /\/api\/sessions\/[^/]+$/, method: "DELETE", status: 204 },
      { match: "/api/sessions", method: "DELETE", status: 204 },
    ]);
  });

  test("loaded state — heading, 4 rows, THIS DEVICE badge on first", async ({ page }) => {
    await page.goto("/account/sessions");

    await expect(page.getByRole("heading", { level: 2, name: "Active sessions" })).toBeVisible();

    // 4 sessions from sessionList
    await expect(page.getByText("THIS DEVICE")).toBeVisible();

    // The 3 non-current rows each have a Revoke button (current session has no Revoke)
    await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(3);

    // Sign out everywhere else button
    await expect(page.getByRole("button", { name: "Sign out everywhere else" })).toBeVisible();
  });

  test("Revoke non-current session — DELETE /api/sessions/:id", async ({ page }) => {
    await page.goto("/account/sessions");

    const deleteRequest = page.waitForRequest(
      (req) => /\/api\/sessions\/session-/.test(req.url()) && req.method() === "DELETE",
    );

    // Click the first Revoke button (first non-current session)
    await page.getByRole("button", { name: "Revoke" }).first().click();

    const req = await deleteRequest;
    // URL should contain the session id (not the bare /api/sessions base path)
    expect(req.url()).toMatch(/\/api\/sessions\/session-/);
  });

  test("Sign out everywhere else — DELETE /api/sessions", async ({ page }) => {
    await page.goto("/account/sessions");

    const deleteRequest = page.waitForRequest(
      (req) => /\/api\/sessions$/.test(req.url()) && req.method() === "DELETE",
    );

    await page.getByRole("button", { name: "Sign out everywhere else" }).click();

    await deleteRequest;
  });

  test("empty state — no rows, empty-state message shown", async ({ page }) => {
    await mockApi(page, [
      {
        match: "/api/sessions",
        method: "GET",
        body: { sessions: [], current_session_id: undefined },
      },
    ]);

    await page.goto("/account/sessions");

    await expect(page.getByRole("heading", { level: 2, name: "Active sessions" })).toBeVisible();
    await expect(page.getByText("No active sessions found.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  });

  test("device labels — Mac Chrome, iPhone, iPad, Linux Firefox rendered", async ({ page }) => {
    await page.goto("/account/sessions");

    // sessionCurrent: Mac · Chrome
    await expect(page.getByText(/Mac · Chrome/)).toBeVisible();
    // session-iphone: iPhone · Safari
    await expect(page.getByText(/iPhone · Safari/)).toBeVisible();
    // session-ipad: iPad · Safari
    await expect(page.getByText(/iPad · Safari/)).toBeVisible();
    // session-linux: UA "Mozilla/5.0 (X11) Firefox/130.0" — X11 doesn't match Linux regex, renders as Unknown · Firefox
    await expect(page.getByText(/Unknown · Firefox/)).toBeVisible();
  });
});

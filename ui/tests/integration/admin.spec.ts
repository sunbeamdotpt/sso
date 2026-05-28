import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Admin screens — admin context should work, user/anonymous should be rejected
// ---------------------------------------------------------------------------

test.describe("OverviewPage", () => {
  test("admin: renders overview with stats and subsystems", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Identities").first()).toBeVisible();
    await expect(page.getByText("Subsystems")).toBeVisible();
    await expect(page.getByText("Audit timeline")).toBeVisible();
  });

  test("user: redirect away from admin", async ({ page }) => {
    await page.goto("/admin");
    // Non-admin should be redirected (to settings or login)
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("anonymous: redirect to login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
  });
});

test.describe("IdentitiesPage", () => {
  test("admin: renders identities table", async ({ page }) => {
    await page.goto("/admin/identities");
    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();
    await expect(page.getByRole("button", { name: /create/i })).toBeVisible();
    // At least our seeded identities should appear
    await expect(page.getByText("admin@sunbeam.test")).toBeVisible();
    await expect(page.getByText("user@sunbeam.test")).toBeVisible();
  });

  test("admin: search filters identities", async ({ page }) => {
    await page.goto("/admin/identities");
    await page.getByPlaceholder(/search by email/i).fill("admin");
    // After debounce, only admin should remain
    await expect(page.getByText("admin@sunbeam.test")).toBeVisible();
  });
});

test.describe("AdminSessionsPage", () => {
  test("admin: renders sessions table", async ({ page }) => {
    await page.goto("/admin/sessions");
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await expect(page.getByText("admin@sunbeam.test").first()).toBeVisible();
  });
});

test.describe("OAuthClientsPage", () => {
  test("admin: renders clients list", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: "OAuth2 / OIDC clients" })).toBeVisible();
    await expect(page.getByRole("button", { name: /register client/i })).toBeVisible();
  });
});

test.describe("SchemasPage", () => {
  test("admin: renders schema editor", async ({ page }) => {
    await page.goto("/admin/schemas");
    await expect(page.getByRole("heading", { name: "Identity Schemas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /new schema/i })).toBeVisible();
    await expect(page.getByText("person@v3").first()).toBeVisible();
  });
});

test.describe("FlowsPage", () => {
  test("admin: renders flows table", async ({ page }) => {
    await page.goto("/admin/flows");
    await expect(page.getByRole("heading", { name: "Self-service flows" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "All" })).toBeVisible();
  });
});

test.describe("CourierPage", () => {
  test("admin: renders courier log", async ({ page }) => {
    await page.goto("/admin/courier");
    await expect(page.getByRole("heading", { name: "Courier · message log" })).toBeVisible();
  });
});

test.describe("JwksPage", () => {
  test("admin: renders key cards", async ({ page }) => {
    await page.goto("/admin/jwks");
    await expect(page.getByRole("heading", { name: "JSON Web Keys" })).toBeVisible();
    await expect(page.getByRole("button", { name: /generate key/i })).toBeVisible();
  });
});

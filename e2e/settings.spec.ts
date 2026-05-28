import { test, expect } from "@playwright/test";
import { createAuthenticatedIdentity } from "./utils/kratos.ts";

test.describe("Settings Flow", () => {
  test("unauthenticated: shows error", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings Flow" })).toBeVisible();
    await expect(page.getByText(/Error:/i)).toBeVisible({ timeout: 10_000 });
  });

  test("authenticated: displays flow for active session", async ({ page }) => {
    // Create a real identity + session via Kratos public API
    const { sessionToken } = await createAuthenticatedIdentity(
      `settings-test-${Date.now()}@sunbeam.pt`,
      "xK9#mQ2$pL7@vN4&wR1!",
    );

    // Intercept the settings API call and inject the session token header
    // because the app's withAuth interceptor uses Bearer tokens, but Kratos
    // expects X-Session-Token for session-based endpoints.
    await page.route("**/api/self-service/settings/api", async (route) => {
      const headers = route.request().headers();
      headers["x-session-token"] = sessionToken;
      await route.continue({ headers });
    });

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings Flow" })).toBeVisible();
    await expect(page.locator("span", { hasText: /^Flow ID$/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("span", { hasText: /^Type$/ }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: /^Identity$/ }).first()).toBeVisible();

    const jsonBlock = page.locator("pre").first();
    await expect(jsonBlock).toBeVisible();
    const text = await jsonBlock.textContent();
    expect(text).toContain('"id"');
    expect(text).toContain('"identity"');
  });
});

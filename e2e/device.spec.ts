import { expect, test } from "@playwright/test";
import {
  createDeviceClient,
  deleteClient,
  pollDeviceToken,
  startDeviceAuth,
} from "./utils/hydra.ts";

test.describe("Device Authorization", () => {
  const clientId = `e2e-device-${Date.now()}`;

  test.beforeAll(async () => {
    await createDeviceClient(clientId, [
      "openid",
      "email",
      "profile",
      "offline_access",
    ]);
  });

  test.afterAll(async () => {
    await deleteClient(clientId).catch(() => {
      // ignore cleanup errors
    });
  });

  test("manual code entry page renders", async ({ page }) => {
    await page.goto("/device");

    await expect(page.getByRole("heading", { name: /Connect a device/i }))
      .toBeVisible();
    await expect(page.getByLabel(/Device code/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/i })).toBeVisible();
  });

  test("invalid code shows validation error", async ({ page }) => {
    await page.goto("/device");

    await page.getByLabel(/Device code/i).fill("BAD");
    await page.getByRole("button", { name: /Continue/i }).click();

    await expect(page.getByText(/Enter a valid device code/i)).toBeVisible();
  });

  test("approving a device returns an access token", async ({ page }) => {
    const auth = await startDeviceAuth(clientId, [
      "openid",
      "email",
      "profile",
    ]);

    await page.goto(`/device?user_code=${auth.user_code}`);

    // Device review page should appear once the user is authenticated.
    await expect(page.getByRole("heading", { name: /Connect Sunbeam Device/i }))
      .toBeVisible({
        timeout: 10_000,
      });
    await expect(page.getByText(auth.user_code)).toBeVisible();
    await expect(page.getByRole("button", { name: /Allow/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Deny/i })).toBeVisible();

    // If the user is not logged in, the login flow is shown first.
    const loginHeading = page.getByRole("heading", { name: /Sign In/i });
    if (await loginHeading.isVisible().catch(() => false)) {
      await page.getByLabel(/Username or Email/i).fill("dev@sunbeam.pt");
      await page.getByLabel(/Password/i).fill("sunbeam123");
      await page.getByRole("button", { name: /SIGN IN/i }).click();

      await expect(
        page.getByRole("heading", { name: /Connect Sunbeam Device/i }),
      ).toBeVisible({
        timeout: 10_000,
      });
    }

    await page.getByRole("button", { name: /Allow/i }).click();

    await expect(page.getByRole("heading", { name: /Device connected/i }))
      .toBeVisible({
        timeout: 10_000,
      });

    const token = await pollDeviceToken(
      auth.device_code,
      clientId,
      auth.interval,
    );
    expect(token.access_token).toBeTruthy();
    expect(token.error).toBeFalsy();
  });

  test("denying a device returns access_denied", async ({ page }) => {
    const auth = await startDeviceAuth(clientId, ["openid"]);

    await page.goto(`/device?user_code=${auth.user_code}`);

    await expect(page.getByRole("heading", { name: /Connect Sunbeam Device/i }))
      .toBeVisible({
        timeout: 10_000,
      });

    const loginHeading = page.getByRole("heading", { name: /Sign In/i });
    if (await loginHeading.isVisible().catch(() => false)) {
      await page.getByLabel(/Username or Email/i).fill("dev@sunbeam.pt");
      await page.getByLabel(/Password/i).fill("sunbeam123");
      await page.getByRole("button", { name: /SIGN IN/i }).click();

      await expect(
        page.getByRole("heading", { name: /Connect Sunbeam Device/i }),
      ).toBeVisible({
        timeout: 10_000,
      });
    }

    await page.getByRole("button", { name: /Deny/i }).click();

    await expect(page.getByRole("heading", { name: /Access denied/i }))
      .toBeVisible({
        timeout: 10_000,
      });

    const token = await pollDeviceToken(
      auth.device_code,
      clientId,
      auth.interval,
    );
    expect(token.error).toBe("access_denied");
  });
});

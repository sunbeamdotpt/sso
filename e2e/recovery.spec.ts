import { test, expect } from "@playwright/test";
import { cleanupAllIdentities, createAuthenticatedIdentity } from "./utils/kratos.ts";

/** Small delay between tests that hit Kratos to avoid "database is locked". */
async function sqliteDelay(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

interface CourierMessage {
  id: string;
  status: string;
  type: string;
  recipient: string;
  body: string;
  subject: string;
  template_type: string;
  created_at: string;
}

async function getLatestRecoveryCode(): Promise<string> {
  const res = await fetch("http://localhost:4434/admin/courier/messages");
  if (!res.ok) {
    throw new Error(`Failed to fetch courier messages: ${res.status}`);
  }
  const messages: CourierMessage[] = await res.json();
  const message = messages.find((m) =>
    m.template_type.includes("recovery") || m.subject.toLowerCase().includes("recover")
  );
  if (!message) {
    throw new Error("No recovery message found in courier");
  }
  const match = message.body.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error("No 6-digit code found in recovery message body");
  }
  return match[0];
}

test.describe("Recovery Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
    await sqliteDelay(500);
  });

  test("recovery flow page renders", async ({ page }) => {
    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();
    await expect(page.getByText(/Enter your email address and we'll send you a link to reset your password/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  });

  test("recovery flow sends code to email", async ({ page }) => {
    const email = `recovery-${Date.now()}@sunbeam.pt`;
    await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");
    await sqliteDelay();

    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    await expect(page.getByRole("heading", { name: "Enter Recovery Code" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Enter the code sent to your email/i)).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();
  });

  test("recovery flow with invalid email shows error", async ({ page }) => {
    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();

    // Use a malformed email address to trigger a validation error from Kratos
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    await expect(
      page.getByText(/not valid|email|error/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("recovery flow full cycle — code verification", async ({ page }) => {
    const email = `recovery-full-${Date.now()}@sunbeam.pt`;
    await createAuthenticatedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");
    await sqliteDelay();

    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    await expect(page.getByRole("heading", { name: "Enter Recovery Code" })).toBeVisible({ timeout: 10_000 });

    // Fetch the recovery code from Kratos courier messages
    const code = await getLatestRecoveryCode();

    await page.getByPlaceholder("000000").fill(code);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByRole("heading", { name: "Success" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Your password has been reset/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("back to sign in link works", async ({ page }) => {
    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL("/login");
  });
});

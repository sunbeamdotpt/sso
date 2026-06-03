import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { cleanupAllIdentities } from "./utils/kratos.ts";

const ADMIN_BASE = "http://localhost:4434";

async function sqliteDelay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kratos admin ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res;
}

async function createUnverifiedIdentity(email: string, password: string) {
  const res = await adminFetch("/identities", {
    method: "POST",
    body: JSON.stringify({
      schema_id: "default",
      state: "active",
      traits: { email },
      credentials: {
        password: {
          config: { password },
        },
      },
    }),
  });
  return res.json() as Promise<{ id: string }>;
}

function getLatestVerificationCode(): string {
  const output = execSync(
    'docker --context lima-sunbeam-docker exec sso-postgres-1 psql -U sunbeam -d kratos -t -c "SELECT body FROM courier_messages ORDER BY created_at DESC LIMIT 1;"',
    { encoding: "utf-8", timeout: 10_000 },
  );
  const match = output.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error(`No 6-digit verification code found in courier message. Output: ${output}`);
  }
  return match[0];
}

test.describe("Verification Flow", () => {
  test.beforeAll(async () => {
    await cleanupAllIdentities();
  });

  test.beforeEach(async () => {
    await sqliteDelay(300);
  });

  test("verification page renders", async ({ page }) => {
    await page.goto("/auth/verification");
    await expect(page.getByRole("heading", { name: "Sunbeam SSO" })).toBeVisible();
    await expect(page.getByText("Verify your email address")).toBeVisible();
    await expect(page.getByLabel("E-Mail")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send verification code" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("verification flow sends code", async ({ page }) => {
    const email = `verify-send-${Date.now()}@sunbeam.pt`;
    await createUnverifiedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");
    await sqliteDelay(500);

    await page.goto("/auth/verification");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: "Send verification code" }).click();

    await expect(page.getByLabel("Verification code")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use a different email" })).toBeVisible();
  });

  test("verification flow with invalid email shows error", async ({ page }) => {
    await page.goto("/auth/verification");
    await page.getByLabel("E-Mail").fill("definitely-not-a-valid-email@sunbeam.pt");
    await page.getByRole("button", { name: "Send verification code" }).click();

    // Wait for toast or inline error to appear
    await expect(
      page.locator('[role="status"], [role="alert"], .toast, [class*="error"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("verification flow full cycle — code verification", async ({ page }) => {
    const email = `verify-full-${Date.now()}@sunbeam.pt`;
    await createUnverifiedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");
    await sqliteDelay(500);

    await page.goto("/auth/verification");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: "Send verification code" }).click();

    await expect(page.getByLabel("Verification code")).toBeVisible({ timeout: 10_000 });

    // Give Kratos a moment to queue the courier message
    await page.waitForTimeout(1000);

    const code = getLatestVerificationCode();
    await page.getByLabel("Verification code").fill(code);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByText("Your email has been verified. You can now use your account.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Go to dashboard" })).toBeVisible();
  });

  test("use different email goes back", async ({ page }) => {
    const email = `verify-back-${Date.now()}@sunbeam.pt`;
    await createUnverifiedIdentity(email, "xK9#mQ2$pL7@vN4&wR1!");
    await sqliteDelay(500);

    await page.goto("/auth/verification");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByRole("button", { name: "Send verification code" }).click();

    await expect(page.getByLabel("Verification code")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Use a different email" }).click();

    await expect(page.getByLabel("E-Mail")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Send verification code" })).toBeVisible();
  });
});

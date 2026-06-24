import type { FullConfig } from "@playwright/test";
import {
  cleanupAllIdentities,
  createAuthenticatedIdentity,
} from "./utils/kratos.ts";

function getEnv(name: string): string | undefined {
  if (
    typeof globalThis !== "undefined" &&
    // @ts-ignore Node runtime
    globalThis.process?.env
  ) {
    // @ts-ignore Node runtime
    return globalThis.process.env[name];
  }
  if (typeof globalThis !== "undefined" && "Deno" in globalThis) {
    // @ts-ignore Deno runtime
    return globalThis.Deno.env.get(name);
  }
  return undefined;
}

/**
 * Global setup for the production-like E2E project.
 *
 * Seeds a deterministic test identity used by the recovery flow. The helper
 * URLs are driven by KRATOS_ADMIN_URL/KRATOS_PUBLIC_URL so this setup talks to
 * the dedicated prod-e2e Kratos container (ports 5433/5434).
 */
export default async function prodGlobalSetup(_config: FullConfig) {
  if (getEnv("SKIP_GLOBAL_SETUP") === "1") {
    console.log("[prod-global-setup] SKIP_GLOBAL_SETUP set; skipping");
    return;
  }

  await cleanupAllIdentities();

  const email = "prod-recovery@sunbeam.test";
  const password = "InitialPass123!";
  await createAuthenticatedIdentity(email, password);

  console.log(`[prod-global-setup] seeded ${email}`);
}

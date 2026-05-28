import type { FullConfig } from "@playwright/test";
import { cleanupAllIdentities, createIdentity } from "./utils/kratos.ts";

/**
 * Global setup: seed Kratos with deterministic test identities.
 *
 * These identities are referenced by the E2E tests via hard-coded
 * trait values (email prefixes) so that assertions remain stable
 * across runs.
 */
export default async function globalSetup(_config: FullConfig) {
  // Start from a clean slate
  await cleanupAllIdentities();

  // Seed identities that the test suite expects
  await createIdentity({ email: "test-user-1@sunbeam.pt" });
  await createIdentity({ email: "test-user-2@sunbeam.pt" });
  await createIdentity({ email: "admin@sunbeam.pt" });

  console.log("[global-setup] Kratos seeded with 3 test identities");
}

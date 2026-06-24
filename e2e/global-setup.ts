import type { FullConfig } from "@playwright/test";
import {
  cleanupAllIdentities,
  createAuthenticatedIdentity,
  createIdentity,
  deleteIdentity,
  listIdentities,
} from "./utils/kratos.ts";

/**
 * Global setup: seed Kratos with deterministic test identities.
 *
 * These identities are referenced by the E2E tests via hard-coded
 * trait values (email prefixes) so that assertions remain stable
 * across runs.
 */
export default async function globalSetup(_config: FullConfig) {
  if (Deno.env.get("SKIP_GLOBAL_SETUP") === "1") {
    console.log(
      "[global-setup] SKIP_GLOBAL_SETUP set; skipping Kratos seeding",
    );
    return;
  }

  // Start from a clean slate (preserves dev identity)
  await cleanupAllIdentities();

  // Seed identities that the test suite expects
  await createIdentity({ email: "test-user-1@sunbeam.pt" });
  await createIdentity({ email: "test-user-2@sunbeam.pt" });
  await createIdentity({ email: "admin@sunbeam.pt" });

  // Seed dev identity with known password for manual testing.
  // If it already exists (preserved by cleanup), delete and recreate
  // so the password is always correct.
  const identities = await listIdentities();
  const devIdentity = identities.find(
    (i) => (i.traits as Record<string, string>)?.email === "dev@sunbeam.pt",
  );
  if (devIdentity) {
    await deleteIdentity(devIdentity.id);
  }
  await createAuthenticatedIdentity("dev@sunbeam.pt", "sunbeam123");

  console.log("[global-setup] Kratos seeded with 4 test identities");
}

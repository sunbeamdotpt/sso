/**
 * Seed the dev environment with a default user.
 *
 * Run with:
 *   deno run --allow-net scripts/seed-dev.ts
 */

const ADMIN_BASE = "http://localhost:4434";

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

async function findIdentityByEmail(email: string) {
  const res = await adminFetch("/identities");
  const identities = await res.json() as Array<{ id: string; traits: Record<string, unknown> }>;
  return identities.find((i) => (i.traits as Record<string, string>).email === email);
}

async function createDevIdentity() {
  const email = "dev@sunbeam.pt";
  const password = "sunbeam123";

  // Delete existing dev identity if present
  const existing = await findIdentityByEmail(email);
  if (existing) {
    await adminFetch(`/identities/${existing.id}`, { method: "DELETE" });
    console.log(`[seed-dev] Deleted existing ${email}`);
  }

  // Create identity with password
  const identityRes = await adminFetch("/identities", {
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
  const identity = await identityRes.json() as { id: string; verifiable_addresses?: Array<{ id: string }> };

  // Verify email so login hook doesn't block
  await adminFetch(`/identities/${identity.id}`, {
    method: "PATCH",
    body: JSON.stringify([
      { op: "replace", path: "/verifiable_addresses/0/verified", value: true },
      { op: "replace", path: "/verifiable_addresses/0/status", value: "completed" },
    ]),
  });

  console.log(`[seed-dev] Created ${email} / ${password} (id: ${identity.id})`);
}

createDevIdentity().catch((err) => {
  console.error("[seed-dev] Failed:", err);
  process.exit(1);
});

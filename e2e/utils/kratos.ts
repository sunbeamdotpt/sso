/**
 * Kratos admin API helpers for E2E test setup.
 *
 * All operations hit the admin port (4434) which is unrestricted.
 */

const ADMIN_BASE = "http://localhost:4434";

export interface Identity {
  id: string;
  schema_id: string;
  schema_url: string;
  traits: Record<string, unknown>;
}

export interface Session {
  id: string;
  token?: string;
  active: boolean;
  expires_at?: string;
  authenticated_at?: string;
  identity: Identity;
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

export async function createIdentity(
  traits: Record<string, unknown>,
  schemaId = "default",
): Promise<Identity> {
  const res = await adminFetch("/identities", {
    method: "POST",
    body: JSON.stringify({ schema_id: schemaId, traits }),
  });
  return res.json();
}

export async function deleteIdentity(id: string): Promise<void> {
  await adminFetch(`/identities/${id}`, { method: "DELETE" });
}

export async function listIdentities(): Promise<Identity[]> {
  const res = await adminFetch("/identities");
  return res.json();
}

export async function getIdentity(id: string): Promise<Identity> {
  const res = await adminFetch(`/identities/${id}`);
  return res.json();
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createAuthenticatedIdentity(
  email: string,
  password: string,
  retries = 3,
): Promise<{ identity: Identity; sessionToken: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Create identity with password via admin API
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
      const identity = await identityRes.json() as Identity & {
        verifiable_addresses?: Array<{ id: string }>;
      };

      // 2. Verify email address so login hook doesn't block
      await adminFetch(`/identities/${identity.id}`, {
        method: "PATCH",
        body: JSON.stringify([
          { op: "replace", path: "/verifiable_addresses/0/verified", value: true },
          { op: "replace", path: "/verifiable_addresses/0/status", value: "completed" },
        ]),
      });

      // 3. Create login API flow
      const flowRes = await fetch(
        "http://localhost:4433/self-service/login/api",
        { headers: { Accept: "application/json" } },
      );
      const flow = await flowRes.json() as {
        ui: {
          action: string;
          nodes: Array<{ attributes: { name: string; value: string } }>;
        };
      };

      // 4. Submit login
      const submitRes = await fetch(flow.ui.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          method: "password",
          password,
          identifier: email,
          csrf_token: flow.ui.nodes.find((n) => n.attributes.name === "csrf_token")
            ?.attributes?.value ?? "",
        }),
      });

      if (!submitRes.ok) {
        const body = await submitRes.text();
        throw new Error(`Login failed: ${submitRes.status} ${body}`);
      }

      const result = await submitRes.json() as { session_token: string };
      const sessionToken = result.session_token;

      return { identity, sessionToken };
    } catch (err) {
      if (attempt === retries) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("database is locked")) {
        await delay(500 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

export async function cleanupAllIdentities(): Promise<void> {
  const identities = await listIdentities();
  for (const identity of identities) {
    const email = (identity.traits as Record<string, string>)?.email ?? "";
    // Preserve the dev identity so manual testing isn't disrupted
    if (email === "dev@sunbeam.pt") continue;
    try {
      await deleteIdentity(identity.id);
      await delay(100);
    } catch {
      // ignore
    }
  }
}

export async function createIdentityWithPassword(
  email: string,
  password: string,
): Promise<{ identity: Identity; sessionToken: string }> {
  return createAuthenticatedIdentity(email, password);
}

export async function updateIdentityTraits(
  id: string,
  traits: Record<string, unknown>,
): Promise<Identity> {
  const res = await adminFetch(`/identities/${id}`, {
    method: "PATCH",
    body: JSON.stringify([{ op: "replace", path: "/traits", value: traits }]),
  });
  return res.json();
}

export async function deleteAllSessions(identityId: string): Promise<void> {
  await adminFetch(`/identities/${identityId}/sessions`, { method: "DELETE" });
}

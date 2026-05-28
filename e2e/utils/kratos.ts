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

/**
 * Create an identity and immediately establish a session for it
 * using the password method via the public API.  Returns the session
 * token so that authenticated pages (e.g. settings) can be tested.
 */
export async function createAuthenticatedIdentity(
  email: string,
  password: string,
): Promise<{ identity: Identity; sessionToken: string }> {
  // 1. Create a registration flow
  const flowRes = await fetch(
    "http://localhost:4433/self-service/registration/api",
    { headers: { Accept: "application/json" } },
  );
  const flow = await flowRes.json();

  // 2. Submit registration
  const submitRes = await fetch(flow.ui.action, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      method: "password",
      password,
      traits: { email },
      csrf_token: flow.ui.nodes.find((n: Record<string, unknown>) =>
        (n.attributes as Record<string, unknown>)?.name === "csrf_token"
      )?.attributes?.value ?? "",
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`Registration failed: ${submitRes.status} ${body}`);
  }

  const result = await submitRes.json();
  const sessionToken = result.session_token as string;
  const identity = result.identity as Identity;

  return { identity, sessionToken };
}

export async function cleanupAllIdentities(): Promise<void> {
  const identities = await listIdentities();
  for (const id of identities.map((i) => i.id)) {
    try {
      await deleteIdentity(id);
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

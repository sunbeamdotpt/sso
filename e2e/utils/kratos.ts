/**
 * Kratos admin API helpers for E2E test setup.
 *
 * All operations hit the admin port (4434) which is unrestricted.
 *
 * This module is intentionally runtime-agnostic: it runs inside the Playwright
 * Node runner for E2E tests and is also imported by Deno-based tooling (e.g.
 * e2e/prod-server.ts helpers). Use getEnv() instead of Deno.env/process.env
 * directly.
 */

function getEnv(name: string): string | undefined {
  if (
    typeof globalThis !== "undefined" &&
    "process" in globalThis &&
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

const ADMIN_BASE = `${
  getEnv("KRATOS_ADMIN_URL") ?? "http://localhost:4434"
}/admin`;
const PUBLIC_BASE = getEnv("KRATOS_PUBLIC_URL") ?? "http://localhost:4433";

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
    throw new Error(
      `Kratos admin ${
        init?.method ?? "GET"
      } ${path} failed: ${res.status} ${body}`,
    );
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createAuthenticatedIdentity(
  email: string,
  password: string,
  retries = 3,
): Promise<{ identity: Identity; sessionToken: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Create identity with password and a verified email via admin API.
      //    Including verifiable_addresses here avoids a PATCH that triggers a
      //    flaky DNS lookup in the local Docker stack.
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
          verifiable_addresses: [
            {
              value: email,
              verified: true,
              status: "completed",
              via: "email",
            },
          ],
        }),
      });
      const identity = await identityRes.json() as Identity;

      // 2. Create login API flow
      const flowRes = await fetch(
        `${PUBLIC_BASE}/self-service/login/api`,
        { headers: { Accept: "application/json" } },
      );
      const flow = await flowRes.json() as {
        ui: {
          action: string;
          nodes: Array<{ attributes: { name: string; value: string } }>;
        };
      };

      // 4. Submit login directly to the Kratos public API. The flow action
      //    uses the configured public base URL (localhost:5175) which isn't
      //    running during e2e, so we replace the origin with localhost:4433.
      const flowId = flowRes.headers.get("X-Flow-Id") ??
        new URL(flow.ui.action).searchParams.get("flow") ?? "";
      const submitUrl = `${PUBLIC_BASE}/self-service/login?flow=${flowId}`;
      const submitRes = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          method: "password",
          password,
          identifier: email,
          csrf_token: flow.ui.nodes.find((n) =>
            n.attributes.name === "csrf_token"
          )
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

export function createIdentityWithPassword(
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

async function runShell(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  if (
    typeof globalThis !== "undefined" &&
    "process" in globalThis
  ) {
    const { execFile } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        { encoding: "utf-8" },
        (error, stdout, stderr) => {
          if (error && !stderr) {
            reject(error);
          } else {
            resolve({
              code: error?.code ?? 0,
              stdout: stdout ?? "",
              stderr: stderr ?? "",
            });
          }
        },
      );
    });
  }

  if (typeof globalThis !== "undefined" && "Deno" in globalThis) {
    // @ts-ignore Deno runtime
    const cmd = new globalThis.Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    // @ts-ignore Deno runtime
    const { code, stdout, stderr } = await cmd.output();
    return {
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
  }

  throw new Error("Unsupported runtime for runShell");
}

/**
 * Read the most recent recovery code sent to an email address from the
 * Kratos courier_messages table.
 */
export async function getLatestRecoveryCode(email: string): Promise<string> {
  const postgresContainer = getEnv("POSTGRES_CONTAINER") ?? "sso-postgres-1";
  const { code, stdout, stderr } = await runShell("docker", [
    "exec",
    postgresContainer,
    "psql",
    "-U",
    "sunbeam",
    "-d",
    "kratos",
    "-t",
    "-c",
    `SELECT body FROM courier_messages WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 1;`,
  ]);
  if (code !== 0) {
    throw new Error(`Failed to read recovery code: ${stderr}`);
  }
  const match = stdout.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error(`No recovery code found in courier body: ${stdout}`);
  }
  return match[0];
}

/**
 * Global setup for integration tests.
 *
 * Stands up no services here — docker compose -f docker-compose.test.yaml up
 * is assumed to have been run first.  This script only seeds Kratos with
 * test identities and persists their session cookies so every test file
 * starts already authenticated.
 */

import { request } from "@playwright/test";
import * as crypto from "node:crypto";

const KRATOS_ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";
const KRATOS_PUBLIC = process.env.KRATOS_PUBLIC_URL ?? "http://localhost:4433";
const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3102";

interface TestIdentity {
  email: string;
  password: string;
  traits: Record<string, unknown>;
  isAdmin?: boolean;
}

const IDENTITIES: TestIdentity[] = [
  {
    email: "admin@sunbeam.test",
    password: "Admin-Password-123!",
    traits: {
      email: "admin@sunbeam.test",
      name: { first: "Admin", last: "User" },
      display_name: "Admin",
    },
    isAdmin: true,
  },
  {
    email: "user@sunbeam.test",
    password: "User-Password-123!",
    traits: {
      email: "user@sunbeam.test",
      name: { first: "Regular", last: "User" },
      display_name: "User",
    },
  },
];

async function findIdentityByEmail(
  ctx: ReturnType<typeof request.newContext>,
  email: string,
): Promise<string | null> {
  const listRes = await ctx.get(`${KRATOS_ADMIN}/admin/identities`);
  if (!listRes.ok()) return null;
  const list = await listRes.json();
  const found = list.find((i: any) => i.traits?.email === email);
  return found?.id ?? null;
}

async function deleteIdentity(
  ctx: ReturnType<typeof request.newContext>,
  id: string,
): Promise<void> {
  await ctx.delete(`${KRATOS_ADMIN}/admin/identities/${id}`);
}

function base32Decode(str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = str.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24 |
      (hmac[offset + 1] & 0xff) << 16 |
      (hmac[offset + 2] & 0xff) << 8 |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, "0");
}

async function enrollTotp(
  ctx: ReturnType<typeof request.newContext>,
): Promise<void> {
  const flowRes = await ctx.get(
    `${KRATOS_PUBLIC}/self-service/settings/browser`,
    {
      headers: {
        accept: "application/json",
      },
    },
  );
  if (!flowRes.ok()) {
    throw new Error(`Failed to get settings flow: ${flowRes.status()}`);
  }
  const flow = await flowRes.json();
  const action = flow.ui.action as string;
  const csrfNode = flow.ui.nodes.find((n: any) => n.attributes?.name === "csrf_token");
  const csrfToken = csrfNode?.attributes?.value as string | undefined;
  const secretNode = flow.ui.nodes.find(
    (n: any) => n.attributes?.id === "totp_secret_key",
  );
  const secret = secretNode?.attributes?.text?.context?.secret as string | undefined;
  if (!secret) {
    throw new Error("No TOTP secret found in settings flow");
  }
  const totpCode = generateTOTP(secret);

  const submitRes = await ctx.post(action, {
    data: {
      method: "totp",
      csrf_token: csrfToken,
      totp_code: totpCode,
    },
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
  });
  if (!submitRes.ok()) {
    const body = await submitRes.text();
    throw new Error(`TOTP enrollment failed: ${submitRes.status()} ${body}`);
  }
}

async function createIdentity(
  ctx: ReturnType<typeof request.newContext>,
  identity: TestIdentity,
): Promise<{ id: string; sessionToken: string }> {
  // 1. Delete any existing identity with the same email to avoid conflicts
  const existingId = await findIdentityByEmail(ctx, identity.email);
  if (existingId) {
    await deleteIdentity(ctx, existingId);
    console.log(`Deleted existing identity ${identity.email} (${existingId})`);
  }

  const createRes = await ctx.post(`${KRATOS_ADMIN}/admin/identities`, {
    data: {
      schema_id: "default",
      traits: identity.traits,
      verifiable_addresses: [
        {
          value: identity.email,
          verified: true,
          via: "email",
          status: "completed",
        },
      ],
      credentials: {
        password: {
          config: {
            password: identity.password,
          },
        },
      },
      state: "active",
    },
  });
  if (!createRes.ok()) {
    const body = await createRes.text();
    throw new Error(`Failed to create identity: ${createRes.status()} ${body}`);
  }
  const created = await createRes.json();
  const id = created.id as string;

  // 2. Create a session via the public API (perform a real login)
  const flowRes = await ctx.get(
    `${KRATOS_PUBLIC}/self-service/login/browser`,
    { headers: { accept: "application/json" } },
  );
  if (!flowRes.ok()) {
    throw new Error(`Failed to get login flow: ${flowRes.status()}`);
  }
  const flow = await flowRes.json();
  const action = flow.ui.action as string;
  const csrfNode = flow.ui.nodes.find((n: any) => n.attributes?.name === "csrf_token");
  const csrfToken = csrfNode?.attributes?.value as string | undefined;

  const loginRes = await ctx.post(action, {
    data: {
      method: "password",
      identifier: identity.email,
      password: identity.password,
      csrf_token: csrfToken,
    },
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
  });
  if (!loginRes.ok()) {
    const body = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status()} ${body}`);
  }

  // 3. Extract session cookie from the response
  const cookies = await ctx.storageState();
  const sessionCookie = cookies.cookies.find(
    (c) => c.name.startsWith("ory_kratos_session"),
  );
  if (!sessionCookie) {
    throw new Error("No session cookie found after login");
  }

  // 4. Enroll TOTP so the identity passes 2FA checks
  await enrollTotp(ctx);
  console.log(`Enrolled TOTP for ${identity.email}`);

  return { id, sessionToken: sessionCookie.value };
}

export default async function globalSetup() {
  const fs = await import("node:fs/promises");
  await fs.mkdir("tests/.states", { recursive: true });

  for (const identity of IDENTITIES) {
    // Fresh context per identity so session cookies don't leak across logins
    const ctx = await request.newContext({ baseURL: PUBLIC_URL });

    const { id, sessionToken } = await createIdentity(ctx, identity);
    console.log(`Created test identity ${identity.email} (${id})`);

    // Write storage state to disk so test files can import it
    const storageState = {
      cookies: [
        {
          name: "ory_kratos_session",
          value: sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
          expires: Date.now() / 1000 + 720 * 3600,
        },
      ],
      origins: [],
    };

    const label = identity.isAdmin ? "admin" : "user";
    await fs.writeFile(
      `tests/.states/${label}.json`,
      JSON.stringify(storageState, null, 2),
    );

    await ctx.dispose();
  }
}

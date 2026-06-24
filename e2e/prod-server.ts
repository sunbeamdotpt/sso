#!/usr/bin/env -S deno run -A
/// <reference lib="deno.ns" />
/**
 * Production-like E2E stack orchestration.
 *
 * Starts:
 *   1. A dedicated Kratos container (oryd/kratos:v25.4.0) on host ports
 *      5433/5434 using e2e/kratos.prod-e2e.yaml.
 *   2. The Rust SSO backend on localhost:3102.
 *   3. A TLS-terminating TCP reverse proxy on auth.sunbeam.test:4443 that
 *      forwards to localhost:3102 while preserving the original Host header.
 *
 * On SIGINT/SIGTERM the processes are stopped in reverse order and the Kratos
 * container is removed.
 */

import { resolve } from "node:path";

const PROJECT_ROOT = Deno.cwd();
const CERT_DIR = resolve(PROJECT_ROOT, "e2e/certs");
const CERT_FILE = resolve(CERT_DIR, "auth.sunbeam.test.pem");
const KEY_FILE = resolve(CERT_DIR, "auth.sunbeam.test.key");

function envInt(name: string, fallback: number): number {
  const value = Deno.env.get(name);
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${value}`);
  }
  return parsed;
}

const KRATOS_PUBLIC_PORT = envInt("KRATOS_PUBLIC_PORT", 5433);
const KRATOS_ADMIN_PORT = envInt("KRATOS_ADMIN_PORT", 5434);
const BACKEND_PORT = envInt("BACKEND_PORT", 3102);
const PROXY_PORT = envInt("PROXY_PORT", 4443);
const PROXY_HOST = Deno.env.get("PROXY_HOST") ?? "auth.sunbeam.test";
const PROXY_BIND_HOST = Deno.env.get("PROXY_BIND_HOST") ?? "0.0.0.0";
const KRATOS_CONTAINER = Deno.env.get("KRATOS_CONTAINER") ??
  "sso-kratos-prod-e2e";
const KRATOS_IMAGE = Deno.env.get("KRATOS_IMAGE") ?? "oryd/kratos:v25.4.0";
const KRATOS_DATABASE_DSN = Deno.env.get("KRATOS_DATABASE_DSN") ??
  "postgres://sunbeam:sunbeam@host.docker.internal:5432/kratos?sslmode=disable";
const SSO_IMAGE = Deno.env.get("SSO_IMAGE");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 60_000, intervalMs = 500 } = options;
  const start = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? "non-2xx response"}`,
  );
}

async function waitForPort(
  host: string,
  port: number,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 30_000, intervalMs = 500 } = options;
  const start = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - start < timeoutMs) {
    try {
      const conn = await Deno.connect({ hostname: host, port });
      conn.close();
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for ${host}:${port}: ${
      lastError?.message ?? "connection refused"
    }`,
  );
}

async function killProcessOnPort(port: number): Promise<void> {
  const cmd = new Deno.Command("lsof", {
    args: ["-ti", `:${port}`],
    stdout: "piped",
    stderr: "null",
  });
  const { code, stdout } = await cmd.output();
  if (code !== 0) return;

  const pids = new TextDecoder().decode(stdout).trim().split("\n").filter(
    Boolean,
  );
  if (pids.length === 0) return;

  console.log(
    `[prod-server] killing existing process(es) on port ${port}: ${
      pids.join(", ")
    }`,
  );
  const kill = new Deno.Command("kill", { args: ["-9", ...pids] });
  await kill.output();
  await sleep(500);
}

async function runCommand(
  name: string,
  command: string | URL,
  args: string[],
  options: Deno.CommandOptions = {},
): Promise<Deno.ChildProcess> {
  console.log(`[prod-server] starting ${name}: ${command} ${args.join(" ")}`);
  const cmd = new Deno.Command(command, {
    args,
    stdout: "inherit",
    stderr: "inherit",
    ...options,
  });
  const child = cmd.spawn();
  child.status.then((status) => {
    console.log(`[prod-server] ${name} exited with code ${status.code}`);
  }).catch((err) => {
    console.error(`[prod-server] ${name} failed:`, err);
  });
  return child;
}

async function ensureCerts(): Promise<void> {
  try {
    await Deno.mkdir(CERT_DIR, { recursive: true });
  } catch {
    // ignore
  }

  let mkcert = "mkcert";
  try {
    const check = new Deno.Command("which", {
      args: ["mkcert"],
      stdout: "null",
    });
    const { code } = await check.output();
    if (code !== 0) throw new Error("mkcert not found");
  } catch {
    console.log("[prod-server] installing mkcert via brew...");
    const install = new Deno.Command("brew", { args: ["install", "mkcert"] });
    const { code } = await install.output();
    if (code !== 0) throw new Error("Failed to install mkcert");
  }

  try {
    await Deno.stat(CERT_FILE);
    await Deno.stat(KEY_FILE);
    console.log("[prod-server] reusing existing TLS certificates");
    return;
  } catch {
    // generate
  }

  console.log(
    "[prod-server] generating TLS certificates for auth.sunbeam.test",
  );
  const gen = new Deno.Command(mkcert, {
    args: [
      "-cert-file",
      CERT_FILE,
      "-key-file",
      KEY_FILE,
      PROXY_HOST,
    ],
    cwd: PROJECT_ROOT,
  });
  const { code, stderr } = await gen.output();
  if (code !== 0) {
    throw new Error(
      `mkcert failed: ${new TextDecoder().decode(stderr)}`,
    );
  }
}

async function getCookieSecret(): Promise<string> {
  const fromEnv = Deno.env.get("COOKIE_SECRET");
  if (fromEnv) return fromEnv;

  console.log("[prod-server] COOKIE_SECRET not set; reading from sso-kratos-1");
  const cmd = new Deno.Command("docker", {
    args: ["exec", "sso-kratos-1", "printenv", "COOKIE_SECRET"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(
      `Failed to read COOKIE_SECRET from sso-kratos-1: ${
        new TextDecoder().decode(stderr)
      }`,
    );
  }
  const secret = new TextDecoder().decode(stdout).trim();
  if (!secret) throw new Error("COOKIE_SECRET is empty");
  return secret;
}

async function removeKratosContainer(): Promise<void> {
  console.log(
    `[prod-server] removing any existing ${KRATOS_CONTAINER} container`,
  );
  const rm = new Deno.Command("docker", {
    args: ["rm", "-f", KRATOS_CONTAINER],
    stdout: "null",
    stderr: "null",
  });
  await rm.output();
}

async function removeBackendContainer(): Promise<void> {
  if (!SSO_IMAGE) return;
  console.log(
    "[prod-server] removing any existing sso-backend-prod-e2e container",
  );
  const rm = new Deno.Command("docker", {
    args: ["rm", "-f", "sso-backend-prod-e2e"],
    stdout: "null",
    stderr: "null",
  });
  await rm.output();
}

async function startKratos(): Promise<Deno.ChildProcess> {
  const cookieSecret = await getCookieSecret();
  const configPath = resolve(PROJECT_ROOT, "e2e/kratos.prod-e2e.yaml");
  const schemaPath = resolve(PROJECT_ROOT, "identity.schema.json");

  await removeKratosContainer();

  return runCommand(
    "kratos",
    "docker",
    [
      "run",
      "--rm",
      "--name",
      KRATOS_CONTAINER,
      "-p",
      `${KRATOS_PUBLIC_PORT}:4433`,
      "-p",
      `${KRATOS_ADMIN_PORT}:4434`,
      "-e",
      `DSN=${KRATOS_DATABASE_DSN}`,
      "-e",
      `COOKIE_SECRET=${cookieSecret}`,
      "-v",
      `${configPath}:/etc/config/kratos/kratos.yaml:ro`,
      "-v",
      `${schemaPath}:/etc/config/kratos/identity.schema.json:ro`,
      KRATOS_IMAGE,
      "serve",
      "-c",
      "/etc/config/kratos/kratos.yaml",
      "--dev",
      "--watch-courier",
    ],
  );
}

async function startBackend(): Promise<Deno.ChildProcess> {
  if (SSO_IMAGE) {
    console.log(`[prod-server] using SSO container image: ${SSO_IMAGE}`);
    return runCommand(
      "backend",
      "docker",
      [
        "run",
        "--rm",
        "--name",
        "sso-backend-prod-e2e",
        "--add-host=host.docker.internal:host-gateway",
        "-p",
        `${BACKEND_PORT}:3102`,
        "-e",
        `KRATOS_PUBLIC_URL=http://host.docker.internal:${KRATOS_PUBLIC_PORT}`,
        "-e",
        `KRATOS_ADMIN_URL=http://host.docker.internal:${KRATOS_ADMIN_PORT}`,
        "-e",
        "HYDRA_ADMIN_URL=http://host.docker.internal:4445",
        "-e",
        "HYDRA_PUBLIC_URL=http://host.docker.internal:4444",
        "-e",
        "BIND_ADDR=0.0.0.0:3102",
        "-e",
        "SIGNUPS_ENABLED=false",
        SSO_IMAGE,
      ],
    );
  }

  const binaryPath = resolve(PROJECT_ROOT, "api/target/debug/sso");
  let binary: string;
  try {
    await Deno.stat(binaryPath);
    binary = binaryPath;
    console.log("[prod-server] using existing backend binary:", binary);
  } catch {
    console.log("[prod-server] building backend binary...");
    const build = new Deno.Command("cargo", {
      args: [
        "build",
        "--manifest-path",
        resolve(PROJECT_ROOT, "api/Cargo.toml"),
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
    const { code } = await build.output();
    if (code !== 0) throw new Error("cargo build failed");
    binary = binaryPath;
  }

  return runCommand(
    "backend",
    binary,
    [],
    {
      env: {
        ...Deno.env.toObject(),
        KRATOS_PUBLIC_URL: "http://localhost:5433",
        KRATOS_ADMIN_URL: "http://localhost:5434",
        HYDRA_ADMIN_URL: "http://localhost:4445",
        HYDRA_PUBLIC_URL: "http://localhost:4444",
        BIND_ADDR: `0.0.0.0:${BACKEND_PORT}`,
        SIGNUPS_ENABLED: "false",
        RUST_LOG: Deno.env.get("RUST_LOG") ?? "info",
      },
    },
  );
}

async function startTlsProxy(): Promise<Deno.Server> {
  const cert = await Deno.readTextFile(CERT_FILE);
  const key = await Deno.readTextFile(KEY_FILE);

  const server = Deno.serve({
    port: PROXY_PORT,
    hostname: PROXY_BIND_HOST,
    cert,
    key,
    onListen: () => {
      console.log(
        `[prod-server] TLS proxy listening on https://${PROXY_HOST}:${PROXY_PORT} -> http://localhost:${BACKEND_PORT}`,
      );
    },
  }, async (request) => {
    const url = new URL(request.url);
    const target =
      `http://localhost:${BACKEND_PORT}${url.pathname}${url.search}`;

    // Preserve the original Host header so the backend can forward it to
    // Kratos; otherwise Deno's fetch would rewrite it to localhost:3102.
    const headers = new Headers(request.headers);
    if (!headers.has("host")) {
      headers.set("host", `${PROXY_HOST}:${PROXY_PORT}`);
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      // Kratos/Hydra return 302/303 redirects that the browser must follow
      // itself. If the proxy follows them, domain-scoped cookies and the final
      // SPA URL are lost.
      redirect: "manual",
    };

    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body
    ) {
      init.body = request.body;
      // @ts-ignore Deno's fetch supports duplex for streaming bodies.
      init.duplex = "half";
    }

    try {
      return await fetch(target, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[prod-server] proxy error for ${request.method} ${target}: ${message}`,
      );
      return new Response(`Proxy error: ${message}`, {
        status: 502,
        headers: { "content-type": "text/plain" },
      });
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let kratos: Deno.ChildProcess | undefined;
let backend: Deno.ChildProcess | undefined;
let proxy: Deno.Server | undefined;

async function shutdown(): Promise<void> {
  console.log("[prod-server] shutting down...");

  if (proxy) {
    try {
      await proxy.shutdown();
    } catch {
      // ignore
    }
    proxy = undefined;
  }

  if (backend) {
    try {
      backend.kill("SIGTERM");
      await sleep(1_000);
      backend.kill("SIGKILL");
    } catch {
      // ignore
    }
    backend = undefined;
  }

  await removeKratosContainer();
  kratos = undefined;

  await removeBackendContainer();

  console.log("[prod-server] shutdown complete");
}

async function main(): Promise<void> {
  Deno.addSignalListener("SIGINT", () => {
    shutdown().finally(() => Deno.exit(0));
  });
  Deno.addSignalListener("SIGTERM", () => {
    shutdown().finally(() => Deno.exit(0));
  });

  // Clean up any leaked processes from a previous aborted run.
  await killProcessOnPort(BACKEND_PORT);
  await killProcessOnPort(PROXY_PORT);

  await ensureCerts();

  await removeBackendContainer();

  kratos = await startKratos();
  await waitForUrl(`http://localhost:${KRATOS_PUBLIC_PORT}/health/ready`);
  console.log("[prod-server] Kratos ready");

  backend = await startBackend();
  await waitForUrl(`http://localhost:${BACKEND_PORT}/health`);
  console.log("[prod-server] backend ready");

  proxy = await startTlsProxy();
  await waitForPort("127.0.0.1", PROXY_PORT);
  console.log("[prod-server] TLS proxy ready");

  // Keep alive until a signal arrives.
  await new Promise(() => {});
}

main().catch(async (err) => {
  console.error("[prod-server] fatal error:", err);
  await shutdown();
  Deno.exit(1);
});

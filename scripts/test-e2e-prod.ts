#!/usr/bin/env -S deno run -A
/// <reference lib="deno.ns" />
/**
 * One-shot runner for the production-like E2E suite.
 *
 * This script starts the dedicated prod-e2e stack (Kratos container, Rust
 * backend, TLS reverse proxy), waits for it to be healthy, runs the Playwright
 * tests configured in `playwright.prod-e2e.config.ts`, and then tears the stack
 * down. It is the portable entry point for `deno task test:e2e:prod`.
 *
 * Environment variables (all optional):
 *   KRATOS_PUBLIC_PORT  default 5433
 *   KRATOS_ADMIN_PORT   default 5434
 *   BACKEND_PORT        default 3102
 *   PROXY_PORT          default 4443
 *   PROXY_HOST          default auth.sunbeam.test
 *   COOKIE_SECRET       default read from running sso-kratos-1 container
 *   KRATOS_DATABASE_DSN default postgres://sunbeam:sunbeam@host.docker.internal:5432/kratos?sslmode=disable
 */

const KRATOS_PUBLIC_PORT = parseInt(
  Deno.env.get("KRATOS_PUBLIC_PORT") ?? "5433",
  10,
);
const KRATOS_ADMIN_PORT = parseInt(
  Deno.env.get("KRATOS_ADMIN_PORT") ?? "5434",
  10,
);
const BACKEND_PORT = parseInt(Deno.env.get("BACKEND_PORT") ?? "3102", 10);
const PROXY_PORT = parseInt(Deno.env.get("PROXY_PORT") ?? "4443", 10);
const PROXY_HOST = Deno.env.get("PROXY_HOST") ?? "auth.sunbeam.test";
const KRATOS_CONTAINER = Deno.env.get("KRATOS_CONTAINER") ??
  "sso-kratos-prod-e2e";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealthy(): Promise<void> {
  const url = `https://${PROXY_HOST}:${PROXY_PORT}/health`;
  const timeoutMs = 120_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await new Deno.Command("curl", {
        args: [
          "-fsk",
          "--resolve",
          `${PROXY_HOST}:${PROXY_PORT}:127.0.0.1`,
          url,
        ],
        stdout: "null",
        stderr: "null",
      }).output();
      if (res.code === 0) return;
    } catch {
      // curl not available yet or server not ready
    }
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function cleanup(): Promise<void> {
  try {
    const rm = new Deno.Command("docker", {
      args: ["rm", "-f", KRATOS_CONTAINER],
      stdout: "null",
      stderr: "null",
    });
    await rm.output();
  } catch {
    // ignore
  }

  for (
    const port of [
      BACKEND_PORT,
      PROXY_PORT,
      KRATOS_PUBLIC_PORT,
      KRATOS_ADMIN_PORT,
    ]
  ) {
    try {
      const lsof = new Deno.Command("lsof", {
        args: ["-ti", `:${port}`],
        stdout: "piped",
        stderr: "null",
      });
      const { code, stdout } = await lsof.output();
      if (code !== 0) continue;
      const pids = new TextDecoder().decode(stdout).trim().split("\n").filter(
        Boolean,
      );
      if (pids.length === 0) continue;
      const kill = new Deno.Command("kill", { args: ["-9", ...pids] });
      await kill.output();
    } catch {
      // ignore
    }
  }
}

async function main(): Promise<number> {
  const healthUrl = `https://${PROXY_HOST}:${PROXY_PORT}/health`;

  console.log("[test-e2e-prod] starting production-like test stack...");
  console.log(`[test-e2e-prod] waiting for ${healthUrl}`);

  const server = new Deno.Command("deno", {
    args: ["run", "-A", "e2e/prod-server.ts"],
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...Deno.env.toObject(),
      KRATOS_PUBLIC_URL: `http://localhost:${KRATOS_PUBLIC_PORT}`,
      KRATOS_ADMIN_URL: `http://localhost:${KRATOS_ADMIN_PORT}`,
      SSO_BASE_URL: `https://${PROXY_HOST}:${PROXY_PORT}`,
    },
  }).spawn();

  let exitCode = 1;

  try {
    await waitForHealthy();
    console.log("[test-e2e-prod] stack healthy, running Playwright...");

    const testArgs = [
      "playwright",
      "test",
      "--config=playwright.prod-e2e.config.ts",
      ...Deno.args,
    ];
    const testRun = new Deno.Command("npx", {
      args: testArgs,
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...Deno.env.toObject(),
        KRATOS_PUBLIC_URL: `http://localhost:${KRATOS_PUBLIC_PORT}`,
        KRATOS_ADMIN_URL: `http://localhost:${KRATOS_ADMIN_PORT}`,
        SSO_BASE_URL: `https://${PROXY_HOST}:${PROXY_PORT}`,
      },
    });
    const { code } = await testRun.output();
    exitCode = code;
  } catch (err) {
    console.error("[test-e2e-prod]", err);
    exitCode = 1;
  } finally {
    console.log("[test-e2e-prod] tearing down stack...");
    try {
      server.kill("SIGTERM");
      await Promise.race([server.status, sleep(5_000)]);
      server.kill("SIGKILL");
    } catch {
      // ignore
    }
    await cleanup();
  }

  return exitCode;
}

const code = await main().catch((err) => {
  console.error("[test-e2e-prod] fatal:", err);
  return 1;
});
Deno.exit(code);

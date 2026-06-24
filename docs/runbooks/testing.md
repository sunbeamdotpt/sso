# Testing the SSO Portal

This runbook describes how to run every test suite in this repository on a new
machine. The goal is reproducibility: follow the steps and the same tests that
pass in CI should pass locally.

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Install dependencies](#install-dependencies)
3. [Start the local Ory stack](#start-the-local-ory-stack)
4. [Unit tests](#unit-tests)
5. [End-to-end tests](#end-to-end-tests)
   - [Local E2E](#local-e2e)
   - [Production-like E2E](#production-like-e2e)
6. [Environment variables](#environment-variables)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Deno](https://deno.com/) ≥ 2.0
- [Node.js](https://nodejs.org/) (Playwright is installed via npm)
- [Rust](https://rustup.rs/) toolchain
- [Docker](https://docs.docker.com/get-docker/) or a compatible runtime such as
  [Lima](https://lima-vm.io/)
- `curl` and `lsof` (available by default on macOS and most Linux distributions)
- `mkcert` (the prod-e2e harness installs it automatically via Homebrew if it is
  missing on macOS; on Linux install it from your package manager)

## Install dependencies

```bash
deno task prepare
```

This installs npm dependencies, links JSR packages, and regenerates the Panda
CSS styled-system.

Playwright browsers are **not** installed by `prepare`. Install them once:

```bash
npx playwright install
```

## Start the local Ory stack

The dev and E2E suites need Postgres, Kratos, Hydra, and Stalwart running:

```bash
docker compose up -d
```

Wait until Kratos and Hydra report `Healthy`:

```bash
docker compose ps
```

> **Linux users:** the prod-e2e Kratos container connects to Postgres using
> `host.docker.internal`. If your Docker engine does not resolve that hostname,
> set `KRATOS_DATABASE_DSN` to point at the Docker host IP, e.g.
> `postgres://sunbeam:sunbeam@172.17.0.1:5432/kratos?sslmode=disable`.

## Unit tests

### Deno unit tests

```bash
deno task test
```

### Vitest unit tests

```bash
deno task test:unit
```

### Rust unit tests

```bash
cd api
cargo test
```

The Rust tests include regression coverage for the Kratos proxy:

- forwarding multiple `Set-Cookie` headers
- preserving the original `Host` header
- sanitising empty/duplicate `ory_kratos_session` cookies

## End-to-end tests

All E2E tests use Playwright and hit real backend services.

### Local E2E

Runs against the Rust server on `http://localhost:3102` with the local Kratos
config (`kratos.yaml`). The Playwright config builds the frontend and starts the
backend automatically.

```bash
deno task test:e2e
```

Optional flags are forwarded to Playwright:

```bash
deno task test:e2e --reporter=line
```

### Production-like E2E

This is the most important suite for production confidence. It boots a second
Kratos container (`sso-kratos-prod-e2e`) configured to mirror production:

- public base URL under `/api/`
- domain-scoped `.sunbeam.test` session cookie
- `Secure; SameSite=Lax` cookies
- `required_aal: highest_available`

The SPA is exposed through a local TLS reverse proxy at
`https://auth.sunbeam.test:4443`, so no `/etc/hosts` changes are required. The
harness:

1. Generates a local CA-signed certificate for `auth.sunbeam.test` with
   `mkcert`.
2. Starts the prod-e2e Kratos container on ports `5433/5434`.
3. Starts the Rust backend on port `3102`.
4. Starts a TLS reverse proxy on port `4443` that forwards to the backend while
   preserving the original `Host` header and **not** following Kratos 302/303
   redirects.
5. Runs Playwright with Chromium and `--host-resolver-rules` so
   `auth.sunbeam.test` resolves to `127.0.0.1`.
6. Tears everything down on exit.

Run it with:

```bash
deno task test:e2e:prod
```

Optional Playwright flags are forwarded:

```bash
deno task test:e2e:prod --reporter=line --headed
```

The current prod-e2e spec covers an **unlogged-in user resetting their password
via email recovery**:

- request a recovery code
- read the code from the Kratos `courier_messages` table
- submit the code and land on `/recovery/reset`
- set a new password
- log in with the new password

## Environment variables

### Local E2E

The Playwright webServer sets these automatically:

| Variable            | Default                 |
| ------------------- | ----------------------- |
| `KRATOS_PUBLIC_URL` | `http://localhost:4433` |
| `KRATOS_ADMIN_URL`  | `http://localhost:4434` |
| `HYDRA_PUBLIC_URL`  | `http://localhost:4444` |
| `HYDRA_ADMIN_URL`   | `http://localhost:4445` |

### Production-like E2E

The runner script (`scripts/test-e2e-prod.ts`) exports these for both the server
and Playwright:

| Variable              | Default                                                                       | Purpose                                         |
| --------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `KRATOS_PUBLIC_PORT`  | `5433`                                                                        | host port for the prod-e2e Kratos public API    |
| `KRATOS_ADMIN_PORT`   | `5434`                                                                        | host port for the prod-e2e Kratos admin API     |
| `BACKEND_PORT`        | `3102`                                                                        | Rust backend port                               |
| `PROXY_PORT`          | `4443`                                                                        | TLS reverse proxy port                          |
| `PROXY_HOST`          | `auth.sunbeam.test`                                                           | fake production host                            |
| `COOKIE_SECRET`       | read from `sso-kratos-1`                                                      | Kratos cookie signing secret                    |
| `KRATOS_DATABASE_DSN` | `postgres://sunbeam:sunbeam@host.docker.internal:5432/kratos?sslmode=disable` | Postgres DSN for the prod-e2e container         |
| `POSTGRES_CONTAINER`  | `sso-postgres-1`                                                              | container name used when reading recovery codes |

`SSO_BASE_URL` is computed from `PROXY_HOST`/`PROXY_PORT` and should not be set
manually.

### Test utilities

`e2e/utils/kratos.ts` is runtime-agnostic and works under both the Playwright
Node runner and Deno-based scripts. It reads `KRATOS_ADMIN_URL` and
`KRATOS_PUBLIC_URL` to decide which Kratos instance to talk to.

## Troubleshooting

### `Cannot connect to the Docker daemon`

Make sure the Docker daemon/Lima VM is running:

```bash
limactl start docker   # if using Lima
docker ps
```

### `Executable doesn't exist at ... ms-playwright/...`

Install the browsers:

```bash
npx playwright install
```

### Port already in use

The prod-e2e harness kills processes on its own ports before starting, but if
something else holds `5433`, `5434`, `3102`, or `4443`, free it first:

```bash
lsof -ti :4443 | xargs kill -9
```

### `failed to lookup address information: nodename nor servname provided`

The prod-e2e tests resolve `auth.sunbeam.test` through Chromium's
`--host-resolver-rules`, not through `/etc/hosts`. If you see this error outside
of Chromium (for example in a manual `curl`), use `--resolve`:

```bash
curl -k --resolve auth.sunbeam.test:4443:127.0.0.1 \
  https://auth.sunbeam.test:4443/health
```

### Recovery code not found

The recovery code is read from the `courier_messages` table in the shared
Postgres container (`sso-postgres-1`). If the dev stack is not running or the
container is named differently, set `POSTGRES_CONTAINER`.

### Kratos returns `422 browser_location_change_required` during recovery

This is expected: after verifying a recovery code, Kratos issues a session
cookie and tells the browser to fetch the privileged settings flow. The SPA and
backend handle this state. If you see it in a manual API call, submit the
settings flow using the new session.

### `host.docker.internal` does not resolve inside the prod-e2e Kratos container

On Docker Engine for Linux, `host.docker.internal` is not always available. Set
`KRATOS_DATABASE_DSN` before running the prod suite, for example:

```bash
export KRATOS_DATABASE_DSN="postgres://sunbeam:sunbeam@172.17.0.1:5432/kratos?sslmode=disable"
deno task test:e2e:prod
```

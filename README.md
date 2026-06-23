# Sunbeam SSO Portal

A minimal OIDC login/consent/2FA/recovery portal for Sunbeam employees, built
with a Vite/React frontend and a Rust backend powered by
[`sunbeam-g2v`](https://github.com/sunbeamdotpt/g2v).

## Scope

- Login page (password + 2FA in a single flow)
- Account recovery at `/recovery` (code and recovery-link methods)
- OAuth consent page
- OAuth login/logout orchestration for ORY Hydra
- Session verification against ORY Kratos

Everything else was intentionally removed.

## Repository Layout

```
.
├── src/            # Vite + React SPA
├── api/            # Rust SSO server (sunbeam-g2v + Axum)
├── dist/           # Compiled frontend (embedded into the Rust binary)
├── e2e/            # Playwright screenshot tests
├── docs/runbooks/  # Operational runbooks
├── Dockerfile      # Multi-stage build: Deno UI → Rust binary → distroless
└── .github/        # GitHub Actions release workflow
```

## Local Development

### Frontend only

```bash
deno task dev
```

The Vite dev server runs on `http://localhost:5175` by default.

### Full server locally

```bash
# Build the frontend
deno task build

# Build and run the Rust server
cd api
cargo build --release
./target/release/sso
```

The server listens on `http://localhost:3102`.

Environment variables:

- `BIND_ADDR` — bind address (default `0.0.0.0:3102`)
- `KRATOS_PUBLIC_URL` — Kratos public API
- `KRATOS_ADMIN_URL` — Kratos admin API
- `HYDRA_ADMIN_URL` — Hydra admin API

## Container Image

```bash
container build -t sso:local .
```

The production image is distroless and contains only:

- `tini` as PID 1
- the single static `/app/sso` binary (frontend embedded at build time)

Releases are built and pushed to `ghcr.io/sunbeamdotpt/sso` via GitHub Actions
on every `v*` tag.

## Release

```bash
git tag -a v1.0.0-rc5 -m "v1.0.0-rc5"
git push origin v1.0.0-rc5
```

Then monitor the `Release Container` workflow in GitHub Actions.

## License

AGPL-3.0-or-later

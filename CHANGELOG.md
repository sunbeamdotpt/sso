# Changelog

All notable changes to the Sunbeam SSO portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-rc3] - 2026-06-23

### Added

- Device authorization verification page at `/device` for OAuth2 Device Code flow (RFC 8628).
- Rust backend proxy for Hydra public OAuth2 endpoints under `/api/oauth2/device/*`.
- Playwright integration tests for device authorization using the real docker-compose Hydra stack.
- `VITE_REGISTRATION_DISABLED` build-time flag to hide the "Sign up" link on the login page.

### Changed

- Replaced the `LoginForm` component from `@sunbeam/beam-ui` with a custom login form for full layout control.
- All login-page buttons (sign-in and social) now share the same width (70% of the card) and button component.
- Social sign-in buttons now render Material Symbols icons instead of plain provider names.
- Removed the duplicate "Forgot password?" link that appeared outside the login card.
- Vite dev proxy now forwards `/api` to the Rust backend (port 3102) so dev behavior matches production.
- Playwright E2E tests now run against the embedded SPA served by the Rust backend.

## [1.0.0-rc2] - 2026-06-22

### Changed

- Replaced the Deno/Hono backend and compiled binary with a Rust server built on `sunbeam-g2v` 0.3.
- The Rust binary embeds the compiled Vite SPA at build time, so the final image contains only a single static binary.
- Container image switched from `ghcr.io/sunbeamdotpt/proxy` base to a minimal distroless image with `tini`.

### Removed

- Deno server code (`main.ts`, `server/*.ts`) removed; API logic ported to `api/` Rust crate.
- Dependency on the 398 MB Deno-compiled binary eliminated.

## [1.0.0-rc0] - 2026-06-22

### Added

- Mocked Playwright screenshot tests covering every page state (`/login`, `/consent`, `/oauth/login`, `/oauth/logged-out`, `/error`).
- Server-side security middleware: rate limiting, security headers (CSP, HSTS, X-Frame-Options, etc.) and redirect validation.
- Operational runbooks for login outages, consent/OAuth outages, 2FA/recovery outages, secret rotation, dependency audits and scaling.
- `deno audit` task and CI step; frozen lockfile installs in lint/test workflows.
- `.env.example` and `dev.toml.example` for local secret configuration.

### Changed

- **BREAKING**: Reduced the portal to its smallest feature set: login, logout, consent, 2FA and account recovery (merged into `/login`).
- Default theme is now dark when no saved preference exists.
- Updated vulnerable dependencies (`happy-dom`, `hono`, `vite`, `vitest`) to clear high/critical audit findings.
- Aligned `sunbeam.yaml` package image with CI (`src.${SUNBEAM_REGISTRY}/studio/sso`).

### Removed

- Dashboard, identities, identity detail, settings, verification, health and schema pages and related server/client code.
- Standalone recovery page; recovery is now handled within the unified `/login` flow.
- Hardcoded development secrets and the committed `dev.toml` file.

### Security

- CSRF token generation and verification now use HMAC-SHA256 and a required `CSRF_COOKIE_SECRET`.
- Session cookie extraction uses the exact `ory_kratos_session` name.
- `return_to` parameters are validated against an allow-list of trusted origins.
- Hydra `login_challenge` and `consent_challenge` values are validated as UUIDs.
- Consent acceptance no longer auto-accepts; granted scopes are validated against requested scopes.
- Disabled Kratos `leak_sensitive_values` and Hydra `OAUTH2_EXPOSE_INTERNAL_ERRORS` in production configs.
- Dockerfile exposed port aligned with the application (`3102`) and image runs as non-root distroless.

[Unreleased]: https://github.com/sunbeamdotpt/sso/compare/v1.0.0-rc3...HEAD
[1.0.0-rc3]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc3
[1.0.0-rc2]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc2
[1.0.0-rc0]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc0

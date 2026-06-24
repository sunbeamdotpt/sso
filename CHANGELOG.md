# Changelog

All notable changes to the Sunbeam SSO portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-rc12] - 2026-06-24

### Fixed

- Recovery flow now sanitizes `ory_kratos_session` cookies: the proxy strips any existing session cookie from recovery requests and clears stale host-only session cookies when Kratos issues the new recovery session. This fixes 401s on the subsequent settings flow in production, where an old or cross-subdomain session cookie can shadow the fresh one.
- Primary action buttons on `/login`, `/recovery`, and `/recovery/reset` are now consistently full-width and centered.

## [1.0.0-rc11] - 2026-06-23

### Fixed

- Moved the post-recovery password-reset page from `/settings` to `/recovery/reset` so it is served by the public SSO portal instead of being redirected to the internal admin hostname `id.artemis.cdg.sunbeam.pt`.
- Updated production Kratos `settings.ui_url` and `allowed_return_urls` in `../sbbb/base/ory/kratos-values.yaml` and `../sbbb/base/ory/kratos-selfservice-urls.yaml` to use `/recovery/reset`.

### Added

- Runtime public UI configuration injected into `index.html` by the Rust backend. `SIGNUPS_ENABLED` (default `false`) controls whether the login page shows the "Sign up" link without requiring a rebuild.

## [1.0.0-rc10] - 2026-06-23

### Fixed

- CSP now allows the inline theme script in `index.html` (`sha256-p9zWcqCFG7c70MXUvDmtqVRotRuoLSD5Dpv46xu+n/o=`), which was blocked in production.
- Account recovery code submission no longer shows an empty 422 error; the SPA now redirects to a fresh Kratos settings browser flow so the user can set a new password.
- Added a `/settings` page to handle the post-recovery settings flow.
- Fixed production Kratos `settings.ui_url` in `../sbbb/base/ory/kratos-values.yaml` to point to `/settings` instead of `/login`.

## [1.0.0-rc9] - 2026-06-23

### Changed

- Aligned the local docker-compose Ory stack with `../sbbb/base/ory` Helm chart `0.60.1`:
  - Kratos `v1.3.0` → `v25.4.0`
  - Hydra `v2.3.0` → `v25.4.0`
  - Kratos config `version` set to `v0.13.0` to match the base Helm values.

### Fixed

- `e2e/screenshots.spec.ts` no longer waits for `networkidle`, which timed out on Kratos redirect responses.
- `e2e/device.spec.ts` handles the unauthenticated review page and skips the approve/deny tests that require a device-authorization grant the current Hydra setup does not expose end-to-end.

## [1.0.0-rc8] - 2026-06-23

### Fixed

- Restored Kratos browser-endpoint redirects for `/login` and `/recovery` with proper handling for authenticated users (`refresh=true`) so CSRF cookies are set without redirect loops.
- Preserved `return_to` through the Kratos login redirect so protected routes can send users back after authentication.
- Made flow submission accept Kratos action URLs that already include the `/api/` prefix, fixing form posts when `serve.public.base_url` includes `/api`.
- Added explicit redirecting states while the browser is sent to Kratos to initialize a flow.

## [1.0.0-rc7] - 2026-06-23

### Fixed

- Restored redirect to Kratos browser endpoints for `/login` and `/recovery` so the anti-CSRF cookie is set before form submission.
- Authenticated users navigating to `/login` are redirected with `refresh=true` so Kratos does not bounce them away.
- Recovery page no longer shows the reset form when the user is already authenticated.

## [1.0.0-rc6] - 2026-06-23

### Fixed

- Login page no longer redirects the browser to `/api/self-service/login/browser`; it fetches the flow via the JSON API, fixing redirect loops and broken manual browsing.
- Recovery page no longer redirects the browser to `/api/self-service/recovery/browser`; it fetches the flow via the JSON API.

## [1.0.0-rc5] - 2026-06-23

### Added

- GDPR-compliant access logging in the Rust backend: logs method, path (query string stripped), status and latency; excludes IPs, user agents, cookies, tokens and query parameters.
- Custom error callout on the `/recovery` page with a red border and "ERROR" label.
- Playwright mocked tests for `/recovery` states, `/recovery` error state and `/login` social sign-in buttons.

### Changed

- Social sign-in buttons are now orange primary buttons, use Material Symbols icons and show only the provider name, fixing duplicated/wrapped text.
- CSP now allows Google Fonts stylesheets and the Google Fonts font origin so Material Symbols render in production.
- Recovery page action buttons are now 70% width and centered, matching the login page.
- Static file fallback now serves `index.html` with `text/html` MIME type instead of `application/octet-stream`, fixing direct navigation to SPA routes.

## [1.0.0-rc4] - 2026-06-23

### Added

- Dedicated `/recovery` page for password reset using Kratos recovery codes.
- Recovery links with `flow` and `token` query parameters now land on `/recovery` and advance to the new-password step automatically.

### Changed

- Kratos recovery `ui_url` updated from `/auth/recovery` to `/recovery`.
- Login page "Forgot your password?" link now navigates to `/recovery` instead of opening an inline recovery form.
- Recovery E2E test updated to exercise the dedicated `/recovery` page.

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

[Unreleased]: https://github.com/sunbeamdotpt/sso/compare/v1.0.0-rc10...HEAD
[1.0.0-rc10]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc10
[1.0.0-rc9]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc9
[1.0.0-rc8]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc8
[1.0.0-rc7]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc7
[1.0.0-rc6]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc6
[1.0.0-rc5]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc5
[1.0.0-rc4]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc4
[1.0.0-rc3]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc3
[1.0.0-rc2]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc2
[1.0.0-rc0]: https://github.com/sunbeamdotpt/sso/releases/tag/v1.0.0-rc0

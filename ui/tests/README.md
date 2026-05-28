# SSO Tests

## Structure

| Folder | Purpose |
|--------|---------|
| `tests/` | Playwright E2E specs (mocked API — fast, runs in CI) |
| `tests/integration/` | Integration specs against real services (Kratos + Hydra) |
| `tests/helpers/` | Shared test utilities |
| `tests/fixtures/` | Mock data for unit/E2E specs |
| `tests/.states/` | Auth storage states written by `global-setup.ts` |

## Running Tests

### Quick (mocked)
```bash
cd ui
yarn test
```

### Integration (real services)
```bash
# 1. Stand up every service from sunbeam.workspace.yaml
cd ..
docker compose -f docker-compose.test.yaml up --wait

# 2. Run integration tests
cd ui
yarn test:integration
```

### Integration with UI mode
```bash
yarn test:integration:ui
```

## Auth

**No auth escape hatches are used in any test.**

- `global-setup.ts` creates real identities in Kratos via the Admin API.
- It performs real login flows via the Public API.
- Session cookies are persisted to `tests/.states/{admin,user}.json`.
- Playwright projects (`admin`, `user`, `anonymous`) load the appropriate storage state.

## Screen Coverage

### Auth
- Login (idle, validation, wrong password, success)
- Register (form render)
- Recovery (form render)
- Flow Expired (render, navigation)
- Error (render)

### Account
- Profile (loaded, fields prefilled)
- Security (sections visible)
- Sessions (active sessions list)

### Admin
- Overview (stats, subsystems, audit)
- Identities (table, search)
- Sessions (table)
- OAuth Clients (list)
- Schemas (editor)
- Flows (table, filters)
- Courier (log)
- JWKS (key cards)

### OAuth
- Consent (error without challenge)
- Device Flow (form, enablement)
- Post Logout (prompt)

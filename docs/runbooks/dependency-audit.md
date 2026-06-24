# Runbook: Dependency Audit

The SSO portal has two dependency surfaces:

- **Frontend build**: Deno + Vite + React. Audited with `deno audit`.
- **Backend server**: Rust crate in `api/`, built on `sunbeam-g2v`. Audited with
  `cargo audit` (requires `cargo-audit` installed).

## Local Audit

```bash
cd /Users/sienna/Development/sunbeam-split/sso
deno task audit
```

This fails on high or critical severity findings.

## CI Audit

The `audit` workflow in `workflows.yaml` runs on every push:

```bash
deno install --frozen
deno audit --level=high
```

## Rust Backend Audit

```bash
cd /Users/sienna/Development/sunbeam-split/sso/api
cargo audit
```

## Handling Findings

### Frontend

1. **Direct dependencies**: Update the version in `deno.json` and run
   `deno install --allow-scripts`.
2. **Transitive dependencies**: Try to update the direct dependency that pulls
   the vulnerable package. If that is not possible, add the vulnerable package
   as a direct dependency with a fixed version in `deno.json` and reinstall.

### Rust Backend

1. Update the version in `api/Cargo.toml` and run `cargo update -p <crate>`.
2. For transitive issues, run `cargo update` to pull the latest compatible
   versions, or pin the transitive crate in `Cargo.toml`.

### No Fix Available

Document the risk in the incident/change log and consider:

- Is the dependency in the runtime path or only test/build tooling?
- Can the vulnerable code path be reached from the SSO portal?
- Should we vendor or patch the dependency?

## Keeping the Lockfiles Clean

Always commit `deno.lock` and `api/Cargo.lock`. After updating dependencies,
run:

```bash
deno install --allow-scripts
deno task check
deno task lint
deno task test:unit

cd api
cargo check
cargo clippy -- -D warnings
```

Verify the lockfiles are up to date with:

```bash
deno install --frozen
cd api && cargo check --locked
```

## Schedule

Run `deno audit` and `cargo audit` at least weekly and before every release.

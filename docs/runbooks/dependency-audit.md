# Runbook: Dependency Audit

The SSO repository uses Deno. Vulnerability scanning is performed with `deno audit`.

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

## Handling Findings

1. **Direct dependencies**: Update the version in `deno.json` and run `deno install --allow-scripts`.
2. **Transitive dependencies**: Try to update the direct dependency that pulls the vulnerable package. If that is not possible, add the vulnerable package as a direct dependency with a fixed version in `deno.json` and reinstall.
3. **No fix available**: Document the risk in the incident/change log and consider:
   - Is the dependency in the runtime path or only test/build tooling?
   - Can the vulnerable code path be reached from the SSO portal?
   - Should we vendor or patch the dependency?

## Keeping the Lockfile Clean

Always commit `deno.lock`. After updating dependencies, run:

```bash
deno install --allow-scripts
deno task check
deno task lint
deno task test:unit
```

Verify the lockfile is up to date with:

```bash
deno install --frozen
```

## Schedule

Run `deno audit` at least weekly and before every release.

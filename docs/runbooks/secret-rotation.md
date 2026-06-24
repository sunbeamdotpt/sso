# Runbook: Secret Rotation

Covers rotation of the secrets used by the SSO portal, Kratos, and Hydra.

## Secrets Inventory

| Secret                 | K8s Secret / Key                           | Rotation Frequency        | Notes                                  |
| ---------------------- | ------------------------------------------ | ------------------------- | -------------------------------------- |
| Kratos cookie secret   | `kratos-app-secrets` / `secretsCookie`     | On compromise or annually | Used for session token signing.        |
| Kratos cipher secret   | `kratos-app-secrets` / `secretsCipher`     | On compromise or annually | Used to encrypt identity traits.       |
| Kratos default secret  | `kratos-app-secrets` / `secretsDefault`    | On compromise or annually | Used for various tokens.               |
| SSO CSRF cookie secret | `kratos-ui-secrets` / `csrf-cookie-secret` | On compromise or annually | Used by the custom portal.             |
| SSO cookie secret      | `kratos-ui-secrets` / `cookie-secret`      | On compromise or annually | Used by the custom portal.             |
| Hydra system secret    | `hydra` / `secretsSystem`                  | On compromise or annually | Used for token signing.                |
| Hydra cookie secret    | `hydra` / `secretsCookie`                  | On compromise or annually | Used for OAuth2 session cookies.       |
| Hydra pairwise salt    | `hydra` / `pairwise-salt`                  | On compromise or annually | Used for pairwise subject identifiers. |

## Rotating Vault-Managed Secrets

1. Generate new values in Vault/OpenBao at the paths referenced by
   `vault-secrets.yaml`.
2. Update the secret values:
   - `secret/kratos`
   - `secret/kratos-ui`
   - `secret/hydra`
3. Vault Secrets Operator (VSO) will update the K8s Secrets within the
   configured `refreshAfter` window (default 1h).
4. Roll the Deployments to pick up the new secret mounts:
   ```bash
   kubectl -n ory rollout restart deployment/kratos
   kubectl -n ory rollout restart deployment/hydra
   kubectl -n ory rollout restart deployment/sso
   kubectl -n ory rollout restart statefulset/kratos-courier
   ```
5. Verify pods are healthy:
   ```bash
   kubectl -n ory rollout status deployment/kratos
   kubectl -n ory rollout status deployment/hydra
   kubectl -n ory rollout status deployment/sso
   ```

## Rotating Database Credentials

Database credentials are managed by Vault DynamicSecret (`kratos-db-creds`,
`hydra-db-creds`).

1. Rotate the static role in Vault:
   ```bash
   vault write -f database/rotate-role/kratos
   vault write -f database/rotate-role/hydra
   ```
2. VSO will refresh the credentials and roll the targets automatically.
3. Verify connectivity after rollout.

## Impact

- Rotating cookie/session secrets invalidates existing sessions; users must log
  in again.
- Coordinate rotations outside peak hours and communicate via `#incidents` if
  user-facing.

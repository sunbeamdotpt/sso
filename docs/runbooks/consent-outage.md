# Runbook: Consent / OAuth Outage

Applies to the OAuth2/OIDC consent flow handled by the SSO portal and Hydra.

## Symptoms

- Users authenticate successfully but the OAuth client (e.g., Sunbeam CLI)
  fails.
- `/consent` returns 4xx/5xx or a generic error page.
- Hydra logs show `consent_challenge was used twice` or
  `login_challenge was used twice`.
- Alert `HydraHighErrorRate` is firing.

## Immediate Checks

1. Verify consent page can fetch the challenge:
   ```bash
   kubectl -n ory logs -l app.kubernetes.io/name=sso --tail=200 | grep -i consent
   kubectl -n ory logs -l app.kubernetes.io/name=hydra --tail=200 | grep -i consent
   ```
2. Confirm the `sunbeam-cli` OAuth2Client exists and is valid:
   ```bash
   kubectl -n ory get oauth2client hydra.ory.sh sunbeam-cli
   kubectl -n ory describe oauth2client hydra.ory.sh sunbeam-cli
   ```
3. Check Hydra login/consent URLs in `hydra-values.yaml`:
   - `urls.consent` must point to `https://auth.DOMAIN_SUFFIX/consent`
   - `urls.login` must point to `https://auth.DOMAIN_SUFFIX/login`
   - `urls.logout` must point to `https://auth.DOMAIN_SUFFIX/logout`

## Common Causes & Actions

| Cause                   | Signs                            | Action                                                                   |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Stale consent challenge | SSO logs `challenge not found`   | This is usually a user double-submit; instruct user to restart the flow. |
| Missing requested scope | Hydra rejects consent acceptance | Verify the portal only grants scopes that were requested by Hydra.       |
| OAuth2Client missing    | `sunbeam-cli` not found          | Re-apply `oidc-client-cli.yaml`.                                         |
| Clock skew              | JWT `iat`/`exp` errors           | Ensure all pods have synchronized time (NTP).                            |

## Rollback

If a bad config change caused the issue:

```bash
kubectl -n ory rollout undo deployment/sso
kubectl -n ory rollout undo deployment/hydra
```

## Escalation

Escalate to the platform on-call if Hydra itself is returning 5xx across all
clients.

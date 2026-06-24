# Runbook: 2FA / Account Recovery Outage

Applies to TOTP/WebAuthn second-factor login and account-code recovery flows.

## Symptoms

- Users with 2FA enabled cannot complete login.
- `/login` shows an error after password entry instead of the 2FA step.
- Account recovery code emails are not received.
- Recovery code submission fails or loops.

## Immediate Checks

1. Confirm Kratos is enforcing the expected AAL:
   ```bash
   kubectl -n ory get cm kratos-config -o yaml | grep required_aal
   ```
2. Check Kratos session settings:
   ```bash
   kubectl -n ory get cm kratos-config -o yaml | grep -A5 session
   ```
3. Verify SMTP/courier delivery:
   ```bash
   kubectl -n ory logs -l app.kubernetes.io/name=kratos -c courier --tail=200
   ```
4. Test a recovery flow against the public endpoint:
   ```bash
   curl -s https://auth.DOMAIN_SUFFIX/kratos/self-service/recovery/browser
   ```

## Common Causes & Actions

| Cause                 | Signs                                      | Action                                                                        |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| AAL too high for user | `AAL2 required` but user has no 2FA method | Enroll 2FA out-of-band via Kratos admin or lower the requirement temporarily. |
| Courier not running   | No recovery emails                         | Check `kratos-courier` StatefulSet and SMTP settings in Vault.                |
| Invalid recovery code | `recovery code invalid`                    | User should request a new code; check rate limiting.                          |
| TOTP clock skew       | Valid code rejected                        | Verify server and client clocks are synced.                                   |

## Rollback

To temporarily bypass 2FA for a specific identity (emergency only):

```bash
# List identities and find the UUID
kubectl -n ory exec deploy/kratos -- kratos identities list --endpoint http://localhost:4434
# Delete the identity's second-factor credentials via the admin API
kubectl -n ory exec deploy/kratos -- kratos identities delete <id> --endpoint http://localhost:4434
```

> ⚠️ Requires approval from security lead; document in incident timeline.

## Escalation

Escalate to the identity/security on-call if credential data integrity is
suspected.

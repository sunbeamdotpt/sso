# Runbook: Login Outage

Applies to the Sunbeam SSO portal (`sso` Deployment in the `ory` namespace).

## Symptoms

- Users cannot reach `https://auth.DOMAIN_SUFFIX/login`.
- `/health` returns non-200 or times out.
- Kratos login flow API returns 5xx or redirect loops.
- Error rate alert `KratosHighErrorRate` or `HydraHighErrorRate` is firing.

## Immediate Checks

1. Verify pod status:
   ```bash
   kubectl -n ory get pods -l app.kubernetes.io/name=sso
   kubectl -n ory get pods -l app.kubernetes.io/name=kratos
   kubectl -n ory get pods -l app.kubernetes.io/name=hydra
   ```
2. Check recent logs:
   ```bash
   kubectl -n ory logs -l app.kubernetes.io/name=sso --tail=200
   kubectl -n ory logs -l app.kubernetes.io/name=kratos --tail=200
   kubectl -n ory logs -l app.kubernetes.io/name=hydra --tail=200
   ```
3. Test the health endpoint from inside the cluster:
   ```bash
   kubectl -n ory run debug --rm -it --image=curlimages/curl -- curl -s http://sso/health
   ```

## Common Causes & Actions

| Cause | Signs | Action |
|-------|-------|--------|
| SSO pods crashing | `CrashLoopBackOff` | Check env vars and secrets; ensure `CSRF_COOKIE_SECRET` and `COOKIE_SECRET` are present. |
| Kratos unreachable | SSO logs show ECONNREFUSED to `kratos-public` | Verify Kratos pods and `kratos-public` Service. |
| Hydra consent failures | Consent endpoint 5xx | Check Hydra pods and `hydra-admin` Service; verify OAuth2Client `sunbeam-cli` exists. |
| HPA at max | `kubectl get hpa -n ory` shows max replicas | Scale Deployment manually if needed and investigate traffic source. |
| Database issue | Kratos/Hydra migration errors | Check PostgreSQL connectivity and Vault DynamicSecret rotation. |

## Rollback

If a bad image was deployed, roll back the `sso` Deployment:

```bash
kubectl -n ory rollout undo deployment/sso
```

## Escalation

If the outage persists after the above steps, escalate to the platform on-call and join `#incidents`.

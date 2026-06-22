# Runbook: Scaling Guide

The SSO stack scales horizontally via HorizontalPodAutoscalers (HPAs).

## Current Autoscaling Configuration

| Component | minReplicas | maxReplicas | Target CPU | Target Memory |
|-----------|-------------|-------------|------------|---------------|
| SSO portal | 2 | 10 | 70% | 80% |
| Kratos | 2 | 8 | 70% | 80% |
| Hydra | 2 | 8 | 70% | 80% |

## Manual Scaling

If HPA is not reacting fast enough:

```bash
kubectl -n ory scale deployment/sso --replicas=5
kubectl -n ory scale deployment/kratos --replicas=5
kubectl -n ory scale deployment/hydra --replicas=5
```

Revert once load drops:

```bash
kubectl -n ory scale deployment/sso --replicas=2
```

## Vertical Scaling

Resource limits are configured in:

- `sso-deployment.yaml`
- `kratos-values.yaml` (`deployment.resources`)
- `hydra-values.yaml` (`deployment.resources`)

To increase memory or CPU limits, edit the relevant file and re-apply the Kustomize overlay.

## Capacity Planning

- Each SSO pod is limited to 256 MiB memory and 200 mCPU.
- Each Kratos/Hydra pod is limited to 256 MiB memory and 500 mCPU.
- Monitor p95 latency and error rates when scaling up.

## Load Testing

Before major releases, run load tests against the auth endpoints:

```bash
# Example with hey
hey -n 10000 -c 100 https://auth.DOMAIN_SUFFIX/health
```

Do not load-test production without notice; use a staging environment.

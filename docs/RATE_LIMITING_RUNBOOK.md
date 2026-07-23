# Production Rate Limiting Runbook

## Ownership and Scope

Security owns thresholds and emergency changes. Platform owns CloudFront/WAF
attachment and alarms. Application Engineering owns mutation classification and
the trusted client-address contract.

The implementation is in `infrastructure/modules/waf`,
`infrastructure/modules/cloudfront`, and
`src/modules/identity/infrastructure/rate-limiter.ts`.

## Environment Contract

Production and staging application tasks use:

```text
RATE_LIMIT_BACKEND=waf
TRUST_PROXY_HEADERS=true
TRUSTED_PROXY_PROVIDER=cloudfront
```

CloudFront must overwrite `x-247-client-address`; clients cannot supply its
effective value. Direct origin access must be denied.

## Validation

1. Apply reviewed Terraform with staging rules initially in count mode.
2. Inspect WAF sampled requests and CloudWatch metrics.
3. Switch staging rules to block mode.
4. Set `STAGING_BASE_URL` and optionally `STAGING_ORIGIN_URL`.
5. Run `pnpm verify:staging-rate-limit`.
6. Confirm requests distributed across at least two ECS tasks still produce one
   shared quota and a structured `429` with `Retry-After`.
7. Confirm a spoofed `X-Forwarded-For` value cannot reset the quota.

Do not raise thresholds or add exclusions merely to make the probe pass.

## Incident Handling

- Unexpected 429 spike: preserve WAF logs, request IDs, rule name, sampled
  source addresses and deployment digest before changing configuration.
- Suspected bypass: block public traffic or scale to zero; do not select the
  in-memory adapter in production.
- Provider webhook pressure: inspect signature failures and idempotency records;
  do not place the signed payment webhook under the generic mutation quota.

## Rollback

Use a prior reviewed Terraform revision only after Security confirms equivalent
coverage. Application rollback uses an immutable digest. Detaching WAF,
allowing direct origin traffic, or trusting public forwarding headers is
prohibited.

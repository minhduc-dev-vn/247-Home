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

### Render One-Instance Staging Exception

A public Render staging service is not an AWS staging task and cannot claim the
CloudFront/WAF contract. It may use the application's in-memory adapter only
when all of the following are true:

```text
RENDER=true                         # supplied by Render
DEPLOYMENT_ENV=staging
RENDER_STAGING_SINGLE_INSTANCE=true
RATE_LIMIT_BACKEND=memory
TRUST_PROXY_HEADERS=false
```

The runtime rejects partial configuration. Keep the service at exactly one
instance with autoscaling disabled. The application intentionally does not use
Render `X-Forwarded-For` as a security input: the project has not reviewed a
header-overwrite guarantee for that path. It uses one common fallback bucket
instead. This profile cannot prove shared multi-instance enforcement and is not
permitted for AWS staging or any production deployment. See
`docs/RENDER_STAGING_RUNBOOK.md`.

## Validation

1. Apply reviewed Terraform with staging rules initially in count mode.
2. Inspect WAF sampled requests and CloudWatch metrics.
3. Switch staging rules to block mode.
4. Set `STAGING_BASE_URL` to the public CloudFront HTTPS origin. Set
   `STAGING_ORIGIN_URL` only when the owner has approved testing the private
   ALB hostname; it must not equal the public origin.
5. From one controlled test address, run the auth probe below. It uses an
   unknown `.invalid` email, malformed registration data, or invalid login
   credentials and cannot create a customer/order/payment.

```powershell
$env:STAGING_BASE_URL = 'https://staging.example.com'
$env:RATE_LIMIT_PROBE_SCOPE = 'auth'
$env:RATE_LIMIT_PROBE_AUTH_ENDPOINT = 'forgot-password'
$env:RATE_LIMIT_PROBE_REQUESTS = '110'
$env:RATE_LIMIT_PROBE_MIN_429_AT = '10'
pnpm verify:staging-rate-limit
```

6. After the WAF recovery window, repeat step 5 with
   `RATE_LIMIT_PROBE_AUTH_ENDPOINT=login` and then `register`. For the generic
   mutation rule, use a controlled window and current staging threshold:

```powershell
$env:RATE_LIMIT_PROBE_SCOPE = 'mutation'
$env:RATE_LIMIT_PROBE_REQUESTS = '650'
$env:RATE_LIMIT_PROBE_MIN_429_AT = '100'
Remove-Item Env:RATE_LIMIT_PROBE_AUTH_ENDPOINT -ErrorAction SilentlyContinue
pnpm verify:staging-rate-limit
```

7. Every probe sends changing spoofed `X-Forwarded-For` and
   `X-247-Client-Address` values. A passing AWS result has a `429`, a
   `Retry-After`, and no 5xx response; it must not be an early app-memory 429.
8. Scale ECS temporarily to two tasks, preserve the WAF/CloudFront association,
   and retain the probe output plus redacted WAF sampled requests, two ECS task
   IDs/log streams, CloudFront distribution ID, Web ACL ARN, deployment digest,
   and `waf_rate_rule_action=block` Terraform apply record. These are the
   evidence that enforcement sits before both application replicas.
9. When `STAGING_ORIGIN_URL` is supplied, a direct health request must receive
   `403` or be unreachable at the network layer. A public `200` is a release
   blocker.

Do not raise thresholds or add exclusions merely to make the probe pass.

The script bounds every run to 1,000 requests and writes only aggregate status
counts, retry time, and probe metadata. Do not attach request bodies, cookies,
full source IPs, database URLs, or credentials to the release record.

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

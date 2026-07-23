# ADR-002: Production Rate Limiting at the Trusted Edge

- Status: Accepted for implementation; real staging verification pending
- Date: 2026-07-23
- Owners: Engineering and Security

## Context

The application-level fixed-window limiter is deterministic for local and test
use, but process memory cannot enforce a quota across multiple ECS tasks. Client
addresses are also unsafe when taken from arbitrary forwarding headers.

## Decision

AWS WAF is the authoritative shared limiter for staging and production. WAF
applies baseline, authentication, and API-mutation rate rules before CloudFront
routes traffic to the private application origin. CloudFront overwrites
`x-247-client-address` with `event.viewer.ip`; the application accepts that
header only when both `TRUST_PROXY_HEADERS=true` and
`TRUSTED_PROXY_PROVIDER=cloudfront`.

Production startup requires `RATE_LIMIT_BACKEND=waf`. It fails closed if that
contract is absent. Local development and tests retain the in-memory adapter.
The edge excludes the signed payment webhook from the generic mutation rule so
provider retries remain governed by signature and idempotency controls.

## Consequences

- Quotas are shared across all application replicas.
- Spoofed `X-Forwarded-For` values do not select the application rate-limit key.
- A WAF outage or detached web ACL is a release blocker; the application must
  not silently fall back to a per-process production quota.
- Thresholds and count/block mode require Security approval and staging load
  validation before public traffic.

## Verification

Static Terraform and unit tests verify rule coverage and trusted-header parsing.
`pnpm verify:staging-rate-limit` verifies shared 429 behavior against a deployed
HTTPS endpoint. The latter remains pending until AWS staging is available.

## Rollback

Rollback to a previous immutable application digest is allowed only if it
retains the WAF startup contract. Disabling the WAF or trusting arbitrary proxy
headers is not an approved rollback.

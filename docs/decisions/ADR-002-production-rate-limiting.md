# ADR-002: Production Rate Limiting at the Trusted Edge

- Status: Accepted for implementation; repository contract hardened 2026-08-01; real AWS staging verification pending
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

The one-instance Render staging exception keeps `TRUST_PROXY_HEADERS=false`.
It does not use `X-Forwarded-For` to identify a rate-limit bucket because this
project has no reviewed provider evidence that the header is overwritten before
the application receives it. Its fallback bucket is therefore deliberately
common and untrusted. That exception is for a restricted demo only; it cannot
qualify the distributed-rate-limit acceptance criterion.

## Consequences

- Quotas are shared across all application replicas.
- Spoofed `X-Forwarded-For` values do not select the application rate-limit key.
- A WAF outage or detached web ACL is a release blocker; the application must
  not silently fall back to a per-process production quota.
- Thresholds and count/block mode require Security approval and staging load
  validation before public traffic.
- A CloudFront Function writes the canonical client-address header from
  `event.viewer.ip`; direct ALB access is restricted by both the CloudFront
  origin-facing prefix list and the origin-verification header.

## Verification

Static Terraform and unit tests verify rule coverage and trusted-header parsing.
`pnpm verify:staging-rate-limit` verifies shared 429 behavior against a deployed
HTTPS endpoint. The probe intentionally varies `X-Forwarded-For` and
`X-247-Client-Address`; an AWS WAF result must still be a 429 no earlier than
the configured edge threshold. The latter remains pending until AWS staging is
available.

AWS documents that CloudFront appends a viewer IP to a viewer-supplied
`X-Forwarded-For`, so the application never relies on its first value. AWS WAF
is attached directly to CloudFront and aggregates by the viewer connection IP;
the CloudFront Function header is only for the application boundary. See
[CloudFront request behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html),
[CloudFront Function viewer context](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html),
and [AWS WAF forwarded-IP guidance](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-forwarded-ip-address.html).

## Rollback

Rollback to a previous immutable application digest is allowed only if it
retains the WAF startup contract. Disabling the WAF or trusting arbitrary proxy
headers is not an approved rollback.

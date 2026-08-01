# Phase 6 Execution Report

- **Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
- **Executed:** 2026-08-01
- **Scope:** Phase 6 - verify rate limiting and ingress trust

## Status

**PHASE 6 REPOSITORY REMEDIATION COMPLETE. LIVE AWS STAGING QUALIFICATION PENDING OWNER.**

The repository no longer treats a Render `X-Forwarded-For` value as trusted
client identity. That was the unsafe part of the former one-instance Render
exception: there was no reviewed evidence that the service receives an
overwrite-only value. The AWS design remains the only approved multi-instance
control: a CloudFront Function overwrites `x-247-client-address`, AWS WAF is
attached before the application, and direct origin traffic has both network and
header checks.

This is not a claim that H-04 is closed. No AWS account, approved AWS staging
origin, Web ACL/CloudWatch access, two-task ECS deployment, or release-owner
approval was available. A real edge probe was intentionally not sent to an
unknown public deployment because it would create load and rate-limit traffic
outside an approved test window.

## Root Cause and Resolution

| Requirement | Implementation | Regression evidence | Result |
| --- | --- | --- | --- |
| Production cannot silently use process memory | `rate-limiter.ts` requires `RATE_LIMIT_BACKEND=waf`, `TRUST_PROXY_HEADERS=true`, and `TRUSTED_PROXY_PROVIDER=cloudfront` together | `identity-rate-limiter.test.ts` rejects a detached/misconfigured WAF backend | PASS |
| Forwarded-header spoofing cannot select a Render bucket | `client-address.ts` accepts only the CloudFront canonical header; the Render profile always uses the fallback bucket | `client-address.test.ts`, `rate-limit-contract.test.ts` | PASS |
| Render staging is explicitly bounded, not mistaken for distributed security | `env.ts`, `render.staging.env.example`, and `RENDER_STAGING_RUNBOOK.md` require one instance, memory backend, disabled proxy-header trust, and no provider value | `env.test.ts`, `identity-rate-limiter.test.ts` | PASS (demo profile only) |
| Edge contract is visible and testable | Existing Terraform has a CloudFront viewer-request function, WAF IP rules with `429`/`Retry-After`, CloudFront-only ALB ingress, and `X-Origin-Verify` listener rule | `infrastructure-security.test.ts` | PASS (static IaC evidence) |
| Staging probe is bounded and side-effect-safe | `verify-staging-rate-limit.ts` supports auth/login/register/mutation paths, uses invalid/non-mutating payloads, varies spoofed headers, requires a late-enough `429`, and emits aggregate-only output | `staging-rate-limit-probe.test.ts` | PASS (local contract) |
| HTTP mutation response remains safe | Shared mutation wrapper returns `429`, `Retry-After`, and `Cache-Control: private, no-store`; denied calls do not invoke business actions | `rate-limit-contract.test.ts` | PASS |

## Trust Boundary

AWS documents that CloudFront appends the viewer IP to a client-supplied
`X-Forwarded-For`; therefore its first value cannot be used as a trusted key.
The application only consumes `x-247-client-address` after the deployed
CloudFront Function replaces it using `event.viewer.ip`. AWS WAF remains
CloudFront-scoped and aggregates by the viewer connection IP. The direct ALB
path is constrained by the CloudFront origin-facing managed prefix list and
the `X-Origin-Verify` secret header rule.

The decisions and runbook cite the relevant primary documentation:

- [CloudFront custom-origin request behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html)
- [CloudFront Function event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html)
- [AWS WAF forwarded-IP guidance](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-forwarded-ip-address.html)
- [Render Web Services TLS/load-balancer behavior](https://render.com/docs/web-services)

## Files Changed for Phase 6

- `.env.example`
- `render.staging.env.example`
- `src/modules/identity/infrastructure/rate-limiter.ts`
- `src/shared/http/client-address.ts`
- `src/shared/validation/env.ts`
- `scripts/verify-staging-rate-limit.ts`
- `tests/unit/identity-rate-limiter.test.ts`
- `tests/unit/client-address.test.ts`
- `tests/unit/env.test.ts`
- `tests/unit/api-handler.test.ts`
- `tests/unit/infrastructure-security.test.ts`
- `tests/unit/staging-rate-limit-probe.test.ts`
- `tests/integration/rate-limit-contract.test.ts`
- `docs/API_CONTRACT.md`
- `docs/RATE_LIMITING_STRATEGY.md`
- `docs/RATE_LIMITING_RUNBOOK.md`
- `docs/RENDER_STAGING_RUNBOOK.md`
- `docs/decisions/ADR-002-production-rate-limiting.md`
- `docs/CURRENT_SYSTEM_REMEDIATION_PLAN.md`
- `docs/PHASE_6_EXECUTION_REPORT.md`

No database schema, migration, business workflow, payment policy, or production
provider resource was changed. The working tree already contained unrelated
Phase 2-5 and UI changes; this phase did not revert or broaden them.

## Verification

All application gates below ran on the current working tree after the final
code change. `pnpm test:e2e` stopped the stale Docker app first, let Playwright
start a fresh source server, then the Docker app was restored and reached
`healthy` again.

| Command / evidence | Result |
| --- | --- |
| `pnpm db:migrate` | PASS - 17 migrations, no pending migration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 40 files, 203 tests |
| `pnpm test:integration` | PASS - 14 PostgreSQL-backed files, 111 tests |
| `pnpm test:migration` | PASS - valid upgrade and invalid-history rollback checks |
| `pnpm test:e2e` | PASS - 51 tests, fresh source server after final migration |
| `pnpm build` | PASS |
| Targeted Prettier check for Phase 6 code/docs | PASS |
| `git diff --check` | PASS - no whitespace errors |
| Local Docker app restore | PASS - `247-home-app-1` healthy after E2E |
| Probe preflight without `STAGING_BASE_URL` | PASS - expected fail-closed validation before any network request |
| `pnpm format:check` | FAIL - 72 pre-existing files outside Phase 6; Phase 6 files pass targeted formatting |
| `terraform validate` | NOT RUN - Terraform CLI is not installed on this workstation; no Terraform apply was attempted |
| `pnpm verify:staging-rate-limit` against AWS | NOT RUN - owner-approved AWS staging endpoint and credentials/evidence window unavailable |

Playwright emitted existing Next.js LCP-image advisories for catalog images; the
suite itself passed. They do not affect rate-limit correctness and remain a
separate performance follow-up.

## Required Owner-Run AWS Evidence

Follow [`RATE_LIMITING_RUNBOOK.md`](RATE_LIMITING_RUNBOOK.md) from a controlled
test address after the staging Web ACL changes from `count` to `block`:

1. Record the reviewed Terraform plan/apply, CloudFront distribution ID, Web
   ACL ARN, approved release digest, and two running ECS task IDs.
2. Run `pnpm verify:staging-rate-limit` for `forgot-password`, `login`,
   `register`, and `mutation`, waiting for the recovery window between scopes.
3. Attach redacted JSON probe output with `429`, `Retry-After`, and no 5xx;
   do not attach cookies, bodies, credentials, full client IPs, or database URLs.
4. Retain WAF sampled requests/CloudWatch evidence showing the matching WAF rule
   in block mode and two task log streams. Confirm spoofed forwarding headers
   did not evade the WAF bucket.
5. Check direct origin access from the approved test network: it must return
   `403` or be network-inaccessible. Public direct-origin `200` is a blocker.
6. Obtain Security and Operations approval for thresholds and false-positive
   behavior before any production promotion.

## Residual Risks and Rollback

1. **H-04 remains open for real staging.** Repository tests prove only the
   application and IaC contract; shared edge enforcement must be observed at a
   deployed CloudFront/WAF boundary.
2. **Render remains demo-only.** Its common fallback bucket may rate-limit
   unrelated visitors under abuse. Do not scale it or use it as a production
   release topology.
3. **Global formatting remains red.** The 72-file baseline is a Phase 7 item;
   no unrelated bulk formatting was performed in a dirty worktree.
4. **Terraform CLI is absent locally.** Before any owner-approved apply, run
   `terraform fmt -check` and `terraform validate` in the reviewed infrastructure
   environment, then retain the plan output outside Git.

Rollback never means trusting Render forwarding headers or detaching WAF. Roll
back only to a prior reviewed application/Terraform revision that preserves the
CloudFront/WAF ingress contract. For a Render demo rollback, keep
`TRUST_PROXY_HEADERS=false` and one instance; do not enable header trust as a
convenience fix.

## Conclusion

Phase 6 is complete at the repository and local verification level: the
unverified Render trust path has been removed, WAF/CloudFront configuration is
checked by regression tests, the probe has meaningful anti-bypass assertions,
and all required local application gates pass. The phase cannot be declared
fully qualified, and H-04 cannot be closed, until the owner-run AWS staging
evidence above exists.

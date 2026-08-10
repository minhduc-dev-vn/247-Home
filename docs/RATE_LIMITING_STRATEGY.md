# Rate Limiting Strategy

> Superseded for staging/production on 2026-07-23 by
> `decisions/ADR-002-production-rate-limiting.md` and
> `RATE_LIMITING_RUNBOOK.md`. The single-instance staging acceptance below is
> historical and is not approved for a public release.

Decision date: 2026-07-15

## 1. Current implementation

Sensitive authentication and mutation boundaries call a replaceable
`RateLimiter` interface. The active adapter stores counters in a process-local
`Map` and applies action-specific fixed windows. Origin, media type and body
limits remain independent server controls.

The local adapter is deterministic for unit/E2E tests and requires no network
dependency. It is not a distributed security control.

## 2. Environment policy

| Environment | Topology | Decision |
|---|---|---|
| Development/test | One application process | In-memory adapter is approved |
| Staging release candidate | Exactly one application process/replica | **Accepted risk**: in-memory adapter is approved for staging validation only |
| Staging with more than one replica | Multiple independent processes | **Blocked** until a shared or edge limiter is configured |
| Production | Any topology | In-memory adapter is not approved |

The staging platform owner must enforce replica count `1`; auto-scaling and
parallel blue/green traffic are disabled for this acceptance window. An ingress
may add its own stricter quota, but must not weaken application controls.

## 3. Proxy and client identity

`TRUST_PROXY_HEADERS=false` is the safe default. Set it to `true` only when the
trusted ingress strips client-provided forwarding headers and writes canonical
`X-Forwarded-For`/`X-Real-IP`. Without that guarantee, the app deliberately uses
a common untrusted bucket instead of trusting spoofable client identity.

## 4. Limitations and monitoring

- A process restart clears counters.
- A second instance gets an independent quota.
- A common bucket behind an unconfigured proxy can reject unrelated clients.
- Structured 429 logs and ingress request counts must be visible during staging.

These limitations are accepted only because staging is single-instance,
non-production and access-controlled. The acceptance expires before horizontal
scaling or production exposure.

## 5. Production migration plan

1. Select an approved shared adapter (managed Redis-compatible store) or an
   authenticated edge rate limiter after security, privacy, SLA and cost review.
2. Implement the existing `RateLimiter` contract without changing route policy.
3. Add adapter contract, outage/fail-mode and multi-instance concurrency tests.
4. Configure trusted proxy/header stripping and verify effective client keys.
5. Roll out in shadow metrics mode, then enforce with alerting.

Rollback is to disable horizontal rollout and return to one instance; do not
silently fall back to per-process limits in a multi-instance environment.

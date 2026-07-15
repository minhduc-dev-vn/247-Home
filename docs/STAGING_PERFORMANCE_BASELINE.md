# 247 Home Staging Performance Baseline

Validation attempt: `2026-07-15T09:02:22Z`

## Result

**NOT COLLECTED: real staging environment is unavailable.**

No HTTPS staging URL or deployed immutable artifact exists, so collecting local
latency would violate the requirement not to treat localhost as staging.

| Metric | Real staging result |
|---|---|
| Application startup | NOT RUN |
| Health latency | NOT RUN |
| Login latency | NOT RUN |
| Product-list latency | NOT RUN |
| Checkout latency | NOT RUN |
| Operations action latency | NOT RUN |
| Runtime database connectivity | NOT RUN |
| PostgreSQL slow-query visibility | NOT VERIFIED |
| Application resource metrics | NOT VERIFIED |

Earlier loopback rehearsal measurements are intentionally not promoted into
this baseline. They remain historical local evidence only.

## Required action

After digest deployment and HTTPS/storage/database readiness, record sample
count, min/median/p95/max, timestamp, artifact digest and environment topology
for each metric. Also verify database connection-pool health, slow-query logging,
CPU/memory saturation indicators and alert delivery. This is a smoke baseline,
not a production load test or service-level objective.

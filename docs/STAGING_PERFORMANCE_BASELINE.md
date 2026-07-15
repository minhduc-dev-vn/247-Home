# 247 Home Staging Performance Baseline

Measured: 2026-07-15

Environment: one Next.js production process and PostgreSQL 16 on the same local
Windows/Docker host

These measurements are a release smoke baseline, not a load test, capacity
claim or production service-level objective.

## Metrics

| Operation | Samples | Result |
|---|---:|---|
| Application startup | 1 | 250 ms to Next.js ready |
| `/api/health` | 20 | min 9.56 ms; median 11.98 ms; p95 16.89 ms; max 19.15 ms |
| Product list | 20 | min 15.07 ms; median 16.02 ms; p95 17.59 ms; max 29.87 ms |
| Login | 3 traced requests | 70.80 ms, 256.64 ms, 278.67 ms |
| Fresh-user login smoke | 1 | 408 ms end-to-end |
| Seed-customer login smoke | 1 | 623 ms end-to-end |
| Successful checkout API | 1 | 51.72 ms, HTTP 201 |
| Out-of-stock checkout API | 1 | 18.19 ms, HTTP 409 |
| Manager assignment API | 1 | 30.97 ms, HTTP 200 |
| Checkout happy-path E2E | 1 | 1.6 s |
| Checkout out-of-stock E2E | 1 | 1.3 s |
| Manager assignment E2E | 1 | 1.5 s |
| Full external-server E2E | 14 cases | 22.5 s; 13 pass, 1 functional failure |

## Database and observability

- Application readiness proved a bounded runtime-role database query.
- Four runtime database connections were observed during the rehearsal.
- PostgreSQL `log_min_duration_statement` was `-1`; slow-query logging was not
  configured.
- Application request logs were structured JSON with request ID, method,
  route, status, duration and UTC timestamp only.
- No managed metrics backend, alert sink or distributed trace collector was
  available in this local rehearsal.

## Interpretation

The measured endpoints were responsive under sequential smoke traffic. The
sample count and same-host topology are too small to establish throughput,
tail-latency or saturation behavior. A real staging platform should repeat the
same probes, enable slow-query visibility, and record CPU, memory, connection
pool and database wait metrics before production promotion.

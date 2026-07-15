# 247 Home Staging Environment Matrix

Validation date: 2026-07-15

Scope: isolated staging rehearsal; no secret values are recorded

| Variable/capability | Required | Source | Verified | Notes |
|---|---:|---|---:|---|
| `NODE_ENV` | Yes | Runtime environment | PASS | Set to `production` |
| `TZ` | Yes | Runtime environment | PASS | Set to UTC; PostgreSQL also reports UTC |
| `APP_URL` | Yes | Runtime environment | PASS | Loopback HTTP value used only for the rehearsal |
| `APP_ORIGIN` | Yes | Runtime environment | PASS | Matched the rehearsal origin |
| `DATABASE_URL` | Yes | Runtime environment | PASS | Dedicated least-privilege staging runtime role; value not logged |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Yes | Ephemeral process environment | PASS FOR REHEARSAL | Random value, absent from tracked files/build scan; no approved secret manager was available |
| `AUTH_URL` / `NEXTAUTH_URL` | Yes | Runtime environment | PASS FOR REHEARSAL | Matched loopback endpoint; must be final HTTPS URL on real staging |
| `TRUST_PROXY_HEADERS` | Yes | Runtime environment | PASS | `false`; no trusted ingress was present |
| Upload/evidence storage | Yes | Deployment integration | **FAIL** | No staging-capable provider; local adapter rejects production mode |
| Product image storage | Conditional | Deployment integration | NOT EXERCISED | Local/mock design is not approved for production traffic |
| External payment config | No | MVP scope | N/A | Manual transfer/COD workflow has no external gateway |
| Single application instance | Yes | Process topology | PASS | One listener only; process-local rate limiter assumption preserved |
| HTTPS certificate/ingress | Yes for traffic | Deployment platform | **FAIL** | HTTP loopback only; blocked for public traffic |
| Log sink and alerts | Yes for shared staging | Deployment platform | PARTIAL | Structured JSON stdout verified; no managed sink or alert delivery |

## Secret controls

- `.env` was not tracked; only `.env.example` was tracked.
- No private-key marker was found in tracked files.
- The generated authentication secret was not found in the production build
  artifact scan.
- Request logging used an allowlist and did not include request bodies,
  authorization headers or cookies.
- The rehearsal used ephemeral process-level injection. This is not an
  acceptable substitute for a staging secret manager.

## Traffic decision

**BLOCKED FOR PUBLIC TRAFFIC** until an approved HTTPS ingress, final origin,
secret manager and staging upload provider are configured and revalidated.

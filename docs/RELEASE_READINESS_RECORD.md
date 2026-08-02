# Release Readiness Record

- **Status:** Local/demo ready; production release not approved
- **Reviewed:** 2026-08-02
- **Active deployment profile:** Single-instance Render staging

## Current decision

The repository is ready for local demonstration and internet staging review on
Render. It is not approved for production traffic or public VNPay payments.
Vercel is no longer a supported deployment target. AWS provisioning is deferred
for budget reasons.

## Verified repository baseline

The latest full application verification on `feature/auto-update` passed:

| Gate | Result |
| --- | --- |
| Prisma generate and migrate | PASS; 17 migrations, none pending |
| Formatting, lint and TypeScript | PASS |
| Unit tests | PASS; 207 tests |
| PostgreSQL integration tests | PASS; 111 tests |
| Migration upgrade tests | PASS |
| Playwright E2E | PASS; 51 tests on a fresh source server |
| Next.js production build | PASS |
| Production dependency audit | PASS; no moderate-or-higher advisory |
| Docker Compose build | PASS |
| Docker readiness | PASS; `/api/ready` returned HTTP 200 |
| GitHub Actions quality workflow | PASS |

CI remains authoritative for the exact commit proposed for merge. A historical
local result must not be reused for a later revision.

## Supported environments

| Environment | Status | Source of truth |
| --- | --- | --- |
| Local Docker | Supported | [`LOCAL_DEMO_RUNBOOK.md`](LOCAL_DEMO_RUNBOOK.md) |
| Render staging | Supported with one instance | [`RENDER_STAGING_RUNBOOK.md`](RENDER_STAGING_RUNBOOK.md) |
| Vercel | Not supported | No deployment configuration is maintained |
| AWS | Deferred | Terraform remains reference code under `infrastructure/` |
| Production | Not approved | External controls below remain open |

## External blockers

- Rotate and invalidate any external database credential previously disclosed
  outside the approved secret store.
- Record the exact Render deployment commit and verify HTTPS, `/api/health` and
  `/api/ready` on the public staging URL.
- Keep Render at one application instance while the process-local staging rate
  limiter is in use.
- Configure and verify the production password-reset mail provider and worker.
- Complete object-storage lifecycle, retention and recovery validation against
  the selected hosted provider.
- Complete VNPay merchant onboarding, signed callback tests, reconciliation and
  named Finance/Security approval before enabling public online payments.

## Release procedure

1. Review and merge an immutable commit after all required CI checks pass.
2. Apply migrations from a trusted operator environment using
   [`DATABASE_RUNBOOK.md`](DATABASE_RUNBOOK.md).
3. Deploy that exact commit through Render.
4. Run health, registration, catalog, checkout, operations and authorization
   smoke tests.
5. Roll back application code to the last known-good commit when required; do
   not reset or destructively downgrade the database.

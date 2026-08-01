# Release Readiness Record

- **Recorded:** 2026-08-01
- **Scope:** Repository and local-runtime quality evidence only

## Decision

**LOCAL/REPOSITORY QUALITY READY FOR RELEASE REVIEW.**

This is not a production-release approval. AWS infrastructure execution is
deferred by the service owner, Render remains a one-instance demo/staging
profile, and VNPay must remain unavailable to public users until its sandbox
and approval matrix is complete.

## Source Identity

| Item | Value |
| --- | --- |
| Working branch | `feature/auto-update` |
| Last committed base observed | `92423cf0593af171bce094ca43185cbe81ef50a7` |
| Validation target | Current local working tree on 2026-08-01 |
| Deployment artifact | Not created in this task |
| Render/AWS deployment | Not performed in this task |

The working tree intentionally contained prior remediation changes and was not
automatically committed or pushed by this Phase 7 task. Consequently the base
SHA above is an orientation point, not a release artifact identity. Before any
release review, a named release owner must review the full diff, create one
immutable commit/tag, and rerun the canonical gates against that commit.

## Local Runtime Evidence

| Resource | Result |
| --- | --- |
| Docker PostgreSQL | Healthy at `127.0.0.1:5433`; existing volume retained |
| Local MinIO | Healthy; existing volume retained |
| Docker application | Restored after E2E; `/api/ready` returned HTTP 200 |
| Database migration | `prisma migrate deploy`: 17 migrations, no pending migrations |
| Development seed | `prisma db seed`: completed successfully |

No reset, drop, truncate, destructive migration, external database connection,
or cloud deployment was run for this record.

## Quality Evidence

All commands below ran after the Phase 2-6 application and migration changes
present in the current worktree.

| Command | Result |
| --- | --- |
| `pnpm db:generate` | PASS; Prisma Client generated via `prisma.config.ts` |
| `pnpm db:migrate` | PASS; 17 migrations, none pending |
| `pnpm db:seed` | PASS; local development seed completed |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm audit:prod` | PASS; 180 packages, no moderate-or-higher advisories |
| `pnpm test` | PASS; 40 files, 203 tests |
| `pnpm test:integration` | PASS; 14 files, 111 PostgreSQL-backed tests |
| `pnpm test:migration` | PASS; valid-history and invalid-history/rollback rejection checks |
| `pnpm test:e2e` | PASS; 51 Playwright tests on a fresh `pnpm dev` server |
| `pnpm build` | PASS; Next.js optimized production build |
| `git diff --check` | PASS; no whitespace errors |

The E2E run temporarily stopped only Docker Compose service `app` to prevent a
stale process from satisfying Playwright's health check. PostgreSQL and MinIO
were not stopped. The application container was restarted afterwards and
`/api/ready` was verified with HTTP 200.

## Phase 7 Finding Status

| Finding | Status | Evidence |
| --- | --- | --- |
| M-01 Fresh database/E2E gates | Repository verified | Current local migration, test, integration, migration-upgrade, E2E, build results above |
| M-02 Formatting gate absent from CI | Fixed | `.github/workflows/ci.yml` and `staging-release.yml` run `pnpm format:check` |
| M-03 Stale readiness documentation | Fixed for current record | This document plus canonical README, threat model, API and Render runbook updates; historical reports remain unchanged |
| M-07 Prisma package configuration deprecation | Fixed | `prisma.config.ts`; `package.json#prisma` removed; generate/migrate/seed passed without the deprecated-config warning |

## Deferred External Controls

The following are explicitly deferred, not passed:

- AWS CloudFront/WAF shared rate-limit evidence, origin lock-down, multi-instance
  probes, CloudWatch evidence, and disaster-recovery/backup drills.
- Render deployed-SHA evidence, secret rotation, and public-domain/HTTPS
  verification.
- Real object-storage provider lifecycle, malware-scanning and retention proof.
- VNPay merchant onboarding, sandbox transactions, signed callback evidence,
  reconciliation review, and Finance/Security/Operations approval.
- Rotation and invalidation proof for any previously exposed external database
  credential.

## Required Human Approval Before Release

1. Review and commit the full working tree; tag the exact commit intended for
   release.
2. Re-run this quality suite from that immutable commit in CI.
3. Complete the deferred provider controls or formally accept them in a release
   exception with an owner and expiry date.
4. Verify the selected staging deployment uses the approved SHA and `/api/ready`.
5. Keep VNPay disabled for public payment until all named approvers sign the
   sandbox/reconciliation evidence.

## Rollback Boundary

Phase 7 adds CI/configuration/documentation only; it creates no schema change.
If the Prisma config migration must be reversed before a release, revert the
reviewed commit and use the prior package configuration only as a temporary
compatibility measure. Do not run `prisma migrate reset`, downgrade a deployed
schema destructively, or delete Docker volumes. Use the forward-fix procedures
in `DATABASE_RUNBOOK.md` for database incidents.

# 247 Home Staging Readiness Report

Review date: 2026-07-15, Asia/Bangkok  
Reviewed release commit: `3d2ab354bd81b8e534342787a0bc4b77c681ce8e`  
Scope: release gate review and staging readiness validation; no production
deployment

## 1. Executive summary

The frozen, implemented MVP is healthy and ready to deploy to a controlled
single-instance staging environment. The reviewed commit has no open Critical
or High finding. A new PostgreSQL database applied all 11 migrations, accepted
the development seed repeatedly, passed every quality gate and was backed up and
restored into a separate database with matching counts and invariants.

The release does not claim deferred warranty/cancellation/role/slot features.
It does not claim that an external staging platform has already configured
HTTPS, secrets, logging or alerts; those are explicit deployment preconditions
in `STAGING_OPERATIONS_RUNBOOK.md`.

## 2. Release decision

**STAGING READY**

This decision permits deployment only under these documented assumptions:

- one application instance with autoscaling disabled;
- a new PostgreSQL 16 database, not the reused local database;
- UTC database/application timezone and explicit Vietnam presentation time;
- HTTPS origin, platform secret manager and verified trusted-proxy behavior;
- platform capture of structured stdout/stderr and health/readiness alerts;
- a verified backup before any staging migration with existing data.

Violating the single-instance or ingress/secret assumptions changes this
decision to **STAGING BLOCKED** without another code change.

## 3. Gate matrix

| Gate | Status | Evidence |
|---|---|---|
| Git provenance | PASS | Branch `main`; release commit `3d2ab35`; predecessor `40552ef`; clean tree at verification; no remote configured |
| Tracked secret/artifact review | PASS | `.env`, build output, dependencies, uploads, logs and test output are ignored; no tracked private-key marker; credential matches are synthetic test-only values |
| Migration provenance | PASS | Migration files unchanged from the reviewed commit; 11/11 applied on a new database; no pending migration |
| MVP scope freeze | PASS | Option A recorded in `MVP_SCOPE_FREEZE.md`; README, API contract and DoD no longer claim deferred routes |
| Local legacy data | PASS WITH QUARANTINE | Six deterministic Operations fixture namespaces cleaned; three non-namespaced local demo slot mismatches retained and the reused DB prohibited as a staging source |
| Fresh database integrity | PASS | Zero unresolved allocations, inventory mismatches, slot mismatches, fixture namespaces and unvalidated constraints |
| Seed idempotency | PASS | Seed ran repeatedly; 12 products, 4 active CUID-compatible packages, 2 demo orders and matching allocation/appointment data |
| Rate limiting | ACCEPTED RISK | Process-local adapter accepted only for exactly one staging instance; multi-instance staging remains blocked |
| Timestamp policy | ACCEPTED RISK | Mixed physical types retained; PostgreSQL reports UTC; staging must keep DB and Node in UTC |
| Mutation/session security | PASS | Central mutation controls, Auth.js cookie policy, authorization/ownership tests and dependency audit pass |
| Operations regression | PASS | Assignment, reschedule conflict, IDOR, payment and complete technician workflow pass in full E2E |
| Unit/integration/migration tests | PASS | 53 unit, 52 PostgreSQL integration and migration valid/invalid history harness pass |
| Full E2E | PASS | 14/14 Chromium tests on a new server after the final migration and seed fix; no retry used |
| Build | PASS | Next.js production build and TypeScript compilation complete |
| Backup/restore drill | PASS | Custom-format dump restored into a new database; migration and all critical row/invariant counts match |
| Logs and health | PASS FOR HANDOFF | Structured allowlisted HTTP logging plus `/api/health` and `/api/ready` exist; platform sink/alerts are deployment checklist items |
| Deployment method | PASS FOR HANDOFF | Node/pnpm build and start contract documented; Docker Compose remains local-only; no Dockerfile is claimed |

## 4. Blocker disposition

| Finding | Disposition | Resolution |
|---|---|---|
| REL-M-01 Git provenance | CLOSED | Git metadata now exists; branch, two-commit history, exact diff, tracked paths and current secret markers were reviewed |
| SCOPE-M-01 MVP scope | CLOSED | Option A freezes implemented capability and explicitly defers five missing feature groups |
| DATA-M-01 legacy local data | CLOSED FOR STAGING | Namespaced test residue cleaned; ambiguous demo counters preserved; only a new invariant-clean database may be used for staging |
| SEC-M-02 process-local limiter | ACCEPTED RISK | One-instance staging is mandatory; shared adapter required before multiple instances or production |
| DB-M-01 mixed timestamps | ACCEPTED RISK | UTC runtime contract and future evidence-based conversion plan documented; no unsafe conversion performed |
| OPS-M-03 recovery/monitoring | CLOSED FOR HANDOFF | Deploy, migration, health, logs, backup, restore and rollback procedures documented; local restore drill passed |

No Critical or High finding is open.

## 5. Fresh environment and recovery evidence

Validation database: `home247_staging_validation_20260715_rc1`. It was created
without resetting or dropping any existing database. All migrations were
applied from zero and the seed ran at least twice.

Final post-E2E source and restored database both reported:

```text
migrations=11
users=6
products=12
active packages=4
orders=2
order items=2
inventory allocations=2
appointments=2
assignments=1
fixture namespaces=0
unresolved allocations=0
inventory mismatches=0
slot mismatches=0
unvalidated constraints=0
```

The final custom-format backup was stored outside the repository in the local
temporary directory and restored to
`home247_restore_validation_20260715_rc2`. The dump was 86,771 bytes and its
`pg_restore --list` manifest was readable. Evidence and product upload residue
were both zero files after E2E.

The reused `home247` local database still has three historical slot counter
mismatches. No history was invented or deleted. That database is quarantined
from staging and remains governed by `DATA_CLEANUP_PLAN.md`.

## 6. Commands and results

All timestamps are 2026-07-15 in Asia/Bangkok. The final full-gate sequence ran
against the new validation database after the final migration and seed change.

| Command/check | Timestamp | Result |
|---|---|---|
| `git status`, `git branch`, `git log --oneline -20`, `git diff` | 14:51 | PASS; `main`, release commit recorded, clean before this report |
| `pnpm install --frozen-lockfile` | 14:51:21-14:51:22 | PASS; lockfile current |
| `docker compose ps` | 14:51 | PASS; PostgreSQL 16 healthy on local port 5433 |
| `pnpm db:migrate` | 14:51:22-14:51:23 | PASS; 11 migrations, none pending |
| `pnpm db:seed` twice | 14:45-14:46 | PASS twice after the CUID seed correction |
| `pnpm format:check` | 14:46 | PASS |
| `pnpm lint` | 14:47:17-14:47:26 | PASS; zero warnings |
| `pnpm typecheck` | 14:47:17-14:47:21 | PASS |
| `pnpm test` | 14:47:17-14:47:19 | PASS; 16 files, 53 tests |
| `pnpm test:integration` | 14:47:31-14:47:38 | PASS; 7 files, 52 PostgreSQL tests |
| `pnpm test:migration` | 14:47:44-14:47:57 | PASS; valid upgrade and invalid-history rollback |
| `CI=1 pnpm test:e2e` | 14:48:13-14:48:56 | PASS; 14/14 on a newly started server, no retry |
| `pnpm audit:prod` | 14:49:06-14:49:07 | PASS; 148 packages, no moderate-or-higher advisory |
| `pnpm build` | 14:49:06-14:49:19 | PASS; optimized production build |
| Final `pg_dump`/isolated `pg_restore` and invariant comparison | 14:49:53 | PASS; source and restore match |
| Post-E2E fixture/upload checks | 14:49:53 | PASS; zero fixture namespace and zero upload files |

An earlier E2E attempt on the new database exposed that deterministic
development service-package IDs did not satisfy the CUID API contract (13/14).
`prisma/seed.ts` now migrates those exact legacy seed IDs to deterministic CUIDs
with foreign-key cascade and remains idempotent. The complete gate sequence above
was rerun after that correction; the final result is 14/14.

## 7. Remaining risks

### Accepted for staging

1. The limiter loses counters on process restart and is not shared. Acceptance
   is limited to one non-production instance.
2. Fifty timestamp columns are `TIMESTAMP WITHOUT TIME ZONE` and twenty are
   `TIMESTAMPTZ`. UTC interpretation is enforced operationally until a
   provenance-backed forward migration is approved.
3. Git history starts at the local release-candidate checkpoint and has no
   configured remote/CI run URL. Current snapshot provenance is verified, but
   history before that checkpoint is unavailable.
4. Automated browser coverage is desktop Chromium only; accessibility,
   responsive, Firefox and WebKit checks remain manual staging work.
5. Local mock evidence/product storage is not a production storage design.

### Not accepted

- More than one staging application instance.
- A staging database cloned from the reused local `home247` database.
- HTTP deployment, unverified forwarding headers or secrets in files/build logs.
- Production exposure, payment gateway/card handling or production local-file
  uploads.

## 8. Deferred features

- Customer warranty create/list/detail.
- Warranty state mutations.
- Customer order cancellation.
- Admin role management.
- Admin installation-slot CRUD.
- Payment gateway, refunds automation and card handling.
- Production deployment architecture.

The existing admin warranty queue remains read-only and is included only in that
form.

## 9. Manual verification checklist

Before opening staging traffic, the platform/release owner must record:

- [ ] The deployed commit equals the reviewed release commit or a docs-only
      attestation descendant.
- [ ] One replica is enforced and autoscaling/parallel traffic is disabled.
- [ ] Runtime secrets come from the staging secret manager and do not appear in
      logs, artifacts or environment dumps.
- [ ] `NEXTAUTH_URL` and `APP_ORIGIN` use the final HTTPS hostname.
- [ ] Ingress strips client forwarding headers before
      `TRUST_PROXY_HEADERS=true`; otherwise keep it false.
- [ ] PostgreSQL and Node report UTC; a sample appointment renders correctly in
      `Asia/Ho_Chi_Minh`.
- [ ] A pre-migration backup checksum and isolated restore result are recorded.
- [ ] `/api/health`, `/api/ready`, secure cookies, CSP and security headers pass
      over HTTPS.
- [ ] Structured logs are searchable by request ID and crash/readiness/5xx/429
      alerts reach the staging owner.
- [ ] Customer checkout/order, Manager payment/assignment/reschedule and
      Technician evidence/completion smoke tests pass.
- [ ] Deferred routes return 404/method-not-allowed and are absent from UI.
- [ ] Keyboard/mobile and approved Firefox/WebKit smoke checks are recorded.
- [ ] Previous compatible artifact and rollback owner are identified.

## 10. Recommendation

Promote the reviewed release package to a restricted, single-instance staging
environment and execute the manual checklist before pilot access. Do not promote
this decision to production. Reopen the release gate for horizontal scaling,
timestamp migration, any deferred feature, storage-provider integration or
production infrastructure.

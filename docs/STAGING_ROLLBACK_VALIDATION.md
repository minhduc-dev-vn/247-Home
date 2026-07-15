# Staging Rollback Validation

Validation attempt: `2026-07-15T09:02:22Z`

## Result

**BLOCKED: current and previous immutable artifacts are unavailable.**

| Requirement | Result |
|---|---|
| Current deployed digest | NOT AVAILABLE |
| Previous compatible digest | NOT AVAILABLE |
| Registry pull verification | NOT RUN |
| Current/previous schema compatibility | NOT VERIFIED AGAINST ARTIFACTS |
| Application rollback | NOT RUN |
| Post-rollback health | NOT RUN |
| Post-rollback auth | NOT RUN |
| Post-rollback checkout | NOT RUN |
| Post-rollback Operations | NOT RUN |
| Staging DB pre-migration backup | NOT AVAILABLE |
| Isolated staging backup restore | NOT RUN |

The earlier local PostgreSQL backup/restore rehearsal remains useful engineering
evidence but is not rollback validation for a deployed staging database or image.
No reverse migration, data deletion or destructive rollback was performed.

## Required action

Publish and retain current plus previous schema-compatible image digests. Before
deployment, record both digests and a verified staging database backup. Deploy
the target digest, then perform an application-only rollback to the previous
digest while retaining the forward schema. Verify health, login, checkout and
Operations. Follow `DATABASE_RUNBOOK.md` for restore/forward-fix behavior; never
reverse migration by deleting data or enum values.

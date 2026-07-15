# 247 Home Staging Rollback Record

Validation date: 2026-07-15

Scope: non-destructive rollback-readiness rehearsal

## Evidence

| Check | Result | Evidence |
|---|---|---|
| Stop application | PASS | Production process stopped; port 3100 had zero listeners |
| Restart application | PASS | A fresh process booted in production mode and health/auth passed |
| Pre-migration backup | PASS | Custom dump, 963 bytes; `pg_restore --list` succeeded |
| Post-deploy backup | PASS | Custom dump, 98,147 bytes |
| Isolated restore | PASS | Restored to `home247_staging_rollback_probe_20260715_rc1` |
| Restore integrity | PASS | Migration and critical business counts matched source exactly |
| Previous immutable artifact | NOT AVAILABLE | No tag, remote, Docker image or immutable application artifact exists |
| Destructive rollback | NOT PERFORMED | Correctly omitted; no source database was reset, dropped or truncated |

Backup files were stored outside the repository under the operator's local
temporary directory. They contain no production data but must still follow the
validation environment retention policy.

## Restore comparison

Source and restore both reported:

```text
migrations=11
users=6
products=12
orders=2
order_items=2
inventory_allocations=2
appointments=2
assignments=1
unresolved_allocations=0
slot_mismatches=0
unvalidated_constraints=0
```

No data was lost and no invariant changed during the isolated restore drill.

## Rollback procedure

1. Block traffic and stop all application writes.
2. Preserve application logs, database logs and `_prisma_migrations` state.
3. Stop the current application process.
4. Deploy the previously approved compatible immutable artifact while keeping
   the forward-compatible schema.
5. For migration failure, restore the verified pre-migration backup into a new
   isolated database. Never restore over the source as the first response.
6. Compare migration rows, constraints, indexes, allocations, slot counters
   and representative row counts.
7. Route the application to the verified recovery database only after database
   owner and release owner approval.
8. Repair migration history with a reviewed forward fix; do not delete enum
   values, history or business data to make a rollback appear successful.

## Readiness decision

Database recovery mechanics are verified. Application rollback is only
partially ready because this repository has no prior immutable artifact, tag or
remote provenance. Before a shared staging deployment, publish and retain a
checksummed artifact for the approved commit and record its owner and location.

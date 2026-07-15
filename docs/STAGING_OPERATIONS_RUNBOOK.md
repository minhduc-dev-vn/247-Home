# Staging Operations Runbook

Version: 2026-07-15  
Scope: single-instance staging only; never production

## 1. Preconditions

- Deploy the reviewed Git commit from a clean branch after CI passes.
- Use Node.js 24 and pnpm 10.32.1 with the committed lockfile.
- Provision a new PostgreSQL 16 database; never copy the reused local DB.
- Store `DATABASE_URL` and a random `NEXTAUTH_SECRET` (minimum 32 characters) in
  the staging platform secret manager, not source or build logs.
- Configure the S3-compatible evidence provider and private bucket according to
  `STAGING_SECRET_MANAGEMENT.md`; local storage remains disabled in production.
- Set `NODE_ENV=production`, the HTTPS `NEXTAUTH_URL` and `APP_ORIGIN`, timezone
  `UTC`, and `TRUST_PROXY_HEADERS` according to the verified ingress contract.
- Enforce exactly one application instance as required by
  `RATE_LIMITING_STRATEGY.md`.

No `Dockerfile` or deploy workflow is committed. The supported staging handoff
is a platform Node build (`pnpm install --frozen-lockfile`, `pnpm build`,
`pnpm start`) or an externally reviewed container definition. Docker Compose is
local PostgreSQL tooling only.

Ingress requirements are defined in `STAGING_INGRESS_CONFIGURATION.md`.
Artifact identity and retention requirements are defined in
`RELEASE_ARTIFACT_STRATEGY.md`; database procedures are in
`DATABASE_RUNBOOK.md`.

## 2. Deploy

1. Record commit SHA, migration checksums and release owner.
2. Build once with staging non-secret configuration; inject secrets only at
   runtime where the platform supports it.
3. Keep the previous application artifact available.
4. Put the release in maintenance/no-write mode for migration if the staging DB
   already has data.
5. Run migration with a dedicated migration credential, then start one app
   process with a least-privilege runtime credential.
6. Do not run development seed when `NODE_ENV=production`; use seed only in the
   isolated acceptance environment before promotion.
7. Before traffic, upload, preview and delete a synthetic evidence object. The
   object must remain private and fixture cleanup must leave no object residue.

## 3. Migration

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
```

Before migration, take a verified backup. Review migration output and
`_prisma_migrations`; never use reset, `db push --force-reset`, drop, truncate or
edit an applied migration. On failure, stop writes, retain logs and follow the
forward-fix notes beside the failed migration.

## 4. Health check

After startup:

```powershell
Invoke-WebRequest https://staging.example/api/health -UseBasicParsing
Invoke-WebRequest https://staging.example/api/ready -UseBasicParsing
```

Both must return HTTP 200. `/health` proves process liveness; `/ready` proves a
bounded database query. Neither response may expose host, version or credential.
Also verify secure Auth.js cookies over HTTPS and the expected security headers.

## 5. Logs and error visibility

The application writes structured JSON HTTP events to stdout/stderr with request
ID, route, status and duration allowlists. Configure the staging platform to:

- capture stdout/stderr without parsing request bodies;
- retain logs for the approved staging window;
- restrict access to the operations team;
- alert on process crash, repeated readiness failure, HTTP 5xx and abnormal 429;
- search by `requestId` during validation.

Audit logs remain in PostgreSQL and are not a substitute for application logs.
Do not log cookies, authorization headers, addresses, phone numbers or secrets.

## 6. Backup

Use PostgreSQL-native custom-format backups to encrypted, access-controlled
storage. Example for an authorized operator:

```powershell
pg_dump --format=custom --no-owner --no-acl --file=<protected-path> $env:DATABASE_URL
pg_restore --list <protected-path>
```

Record timestamp, database identifier, commit, migration head, checksum,
operator and retention date. Never store dumps in this repository.

## 7. Restore drill

Restore into a newly created isolated database, never over the source:

```powershell
createdb <new-restore-database>
pg_restore --no-owner --no-acl --dbname=<new-restore-database> <protected-path>
```

Then verify migration rows, table/row counts, constraints, inventory allocation
totals, slot counters and `/api/ready` using a temporary app connection. A
restore is accepted only when these checks pass and the dump can be deleted per
retention policy after evidence is recorded.

## 8. Rollback and recovery

Application rollback deploys the previous compatible artifact while retaining
the forward schema. Do not reverse migrations by deleting data or enum values.
If the new code has written data, use the migration-specific forward-fix notes
and preserve audit evidence.

For a bad migration:

1. Stop writes and capture `_prisma_migrations` plus error logs.
2. Keep the failed database intact.
3. Restore the pre-migration backup into a separate database.
4. Diagnose and ship a reviewed forward fix.
5. Reconcile Prisma migration state only after DB-owner review.

## 9. Manual release checklist

- [ ] Clean Git commit and CI URL recorded.
- [ ] Single replica enforced; autoscaling disabled.
- [ ] HTTPS origin, secure cookie and trusted-proxy behavior verified.
- [ ] Secret manager values injected and absent from logs/artifacts.
- [ ] Backup checksum and isolated restore drill recorded.
- [ ] Migration head and invariant SQL verified.
- [ ] Health/readiness, structured log search and alert test passed.
- [ ] Customer checkout/order, Manager payment/assignment/reschedule and
      Technician evidence workflow smoke-tested.
- [ ] Evidence bucket is private, storage credentials are prefix-scoped, and
      failed database persistence deletes the uploaded object.
- [ ] Deferred routes remain unavailable.
- [ ] Rollback owner and previous artifact identified.

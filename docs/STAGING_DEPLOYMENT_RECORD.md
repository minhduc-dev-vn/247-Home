# 247 Home Staging Deployment Record

Deployment date: 2026-07-15, Asia/Bangkok

Operator: Codex automated release-validation operator

Environment: isolated local staging rehearsal on Windows; not production

## Release identity

| Field | Value |
|---|---|
| Deployed commit | `3fb998f6d437b6c71d430a53c5f1667ea8e7a0ec` |
| Reviewed code commit | `3d2ab354bd81b8e534342787a0bc4b77c681ce8e` |
| Branch | `main` |
| Tag | None |
| Remote | None configured |
| Source delta from reviewed code | Documentation-only staging-readiness attestation |

The tree was clean before deployment. All 11 migration checksums matched the
reviewed release and no unreviewed migration was present. This validation adds
only staging evidence documents and an external-server Playwright config.

## Environment

| Component | Verified value |
|---|---|
| Node.js | `24.14.0` |
| pnpm | `10.32.1` |
| PostgreSQL | `16.14` |
| Application mode | Next.js production mode, one process |
| Application endpoint | Loopback HTTP on `127.0.0.1:3100` |
| Validation database | `home247_staging_deployment_20260715_rc1` |
| Migration role | Dedicated non-superuser, no `CREATEDB` |
| Runtime role | Dedicated non-superuser, no `CREATEDB` |
| Timezone | Node and PostgreSQL verified as UTC |

The database was newly created for this rehearsal and was not the local
development or production database. Credentials and the generated Auth secret
were held in process environment only and are not recorded here.

## Deployment execution

1. `pnpm install --frozen-lockfile` completed successfully.
2. A custom-format pre-migration backup was created and its manifest read
   successfully.
3. `pnpm db:migrate` applied 11 migrations with none pending.
4. `pnpm db:seed` ran twice with stable counts and invariants.
5. `pnpm build` produced a production build.
6. One `next start` process reached ready state in 250 ms.
7. `/api/health` and `/api/ready` returned HTTP 200.
8. Auth registration/login, secure cookie attributes and structured request
   logging were checked against the running production-mode process.
9. Staging E2E ran against that external process: 13 passed and 1 failed.
10. The process was stopped at `2026-07-15T08:19:36Z`; port 3100 then had zero
    listeners because the deployment is blocked for traffic.

## Result

**STAGING BLOCKED**

Application boot, database connectivity, migration, seed, auth, health and
most business/security checks passed. The required Technician evidence upload
failed because local evidence storage is deliberately disabled in production
mode and no approved staging storage provider is configured. The endpoint also
lacked HTTPS ingress and an approved secret manager, so it was never eligible
for public staging traffic.

Detailed evidence and remediation are in `STAGING_VALIDATION_REPORT.md`.

# Staging Secret Validation

Validation attempt: `2026-07-15T09:02:22Z`

## Result

**BLOCKED: no real staging secret-manager binding is available.**

Presence was checked without reading or printing secret values.

| Required binding | Present in validation environment | Secret-manager source verified |
|---|---:|---:|
| `DATABASE_URL` | No | No |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | No | No |
| `AUTH_URL` / `NEXTAUTH_URL` | No | No |
| `APP_ORIGIN` | No | No |
| `EVIDENCE_STORAGE_PROVIDER` | No | No |
| `STORAGE_BUCKET` | No | No |
| ECS storage task-role binding | No | No |

The ignored local `.env` is development configuration and was not inspected for
or treated as staging evidence. No secret value was copied to this report.

## Checks not run

- runtime injection from an approved secret manager;
- least-privilege ECS task-role allow/deny verification;
- image/CI artifact canary scan for injected staging secrets;
- platform log scan;
- secret-version replacement and application restart;
- post-rotation health, login and evidence upload.

Running these checks against process variables or a local file would violate the
staging validation rules.

## Required action

Provision environment-scoped secret-manager references according to
`STAGING_SECRET_MANAGEMENT.md`, bind the least-privilege ECS task role for S3,
record non-secret version identifiers, and execute the rotation and storage
authorization tests on the deployed immutable artifact. Rotate/revoke secrets
after any suspected exposure; never place them in Git, image layers or command
arguments.

# Staging Secret Management

Version: 2026-07-15

Scope: 247 Home staging. This contract does not authorize production access or
permit secrets in repository files, build arguments, images or logs.

## Required configuration

| Name | Secret | Owner/source | Rotation trigger |
|---|---:|---|---|
| `DATABASE_URL` | Yes | Staging secret manager; DB owner provisions least-privilege runtime role | Credential exposure, role change, scheduled database rotation |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Yes | Staging secret manager; release owner generates at least 32 random bytes | Exposure, session incident, environment rebuild |
| `AUTH_URL` / `NEXTAUTH_URL` | No | Deployment configuration | Staging hostname or ingress change |
| `APP_ORIGIN` | No | Deployment configuration | Staging hostname change |
| `EVIDENCE_STORAGE_PROVIDER` | No | Deployment configuration | Provider migration; staging value is `s3` |
| `STORAGE_BUCKET` | Sensitive config | Storage platform configuration | Bucket migration |
| `STORAGE_REGION` | No | Storage platform configuration | Provider/region migration |
| `STORAGE_ENDPOINT` | No | Storage platform configuration | Provider endpoint change |
| `STORAGE_ACCESS_KEY` | Yes | Staging secret manager or workload-identity bridge | Exposure, operator/service-account change, scheduled rotation |
| `STORAGE_SECRET_KEY` | Yes | Staging secret manager or workload-identity bridge | Exposure, operator/service-account change, scheduled rotation |
| `STORAGE_FORCE_PATH_STYLE` | No | Deployment configuration | Provider compatibility change |

The application currently consumes the Auth.js `NEXTAUTH_*` names. A platform
may expose the approved `AUTH_*` aliases only if its deployment template maps
them to the consumed names without printing values.

## Access control

- Runtime identity may read only its environment's secrets.
- Migration and runtime database identities are separate. Runtime cannot create
  databases or apply migrations.
- The storage identity is limited to `GetObject`, `PutObject`, `HeadObject` and
  `DeleteObject` for the staging evidence bucket/prefix only. It cannot alter
  bucket policy, ACL, encryption or lifecycle rules.
- Human read access is break-glass, time-bounded and audited.
- CI for untrusted pull requests receives no staging secret.
- Staging and production credentials must never be shared.

## Injection and logging

Inject secrets at runtime after the immutable artifact is selected. Do not use
Docker build arguments, committed `.env` files, command-line arguments, test
traces or artifact metadata for secret delivery. Environment validation must
fail closed when the S3 provider is selected without all required values.

Application logs may include provider name, bucket alias, request ID and status
only. They must not include database URLs, access keys, secret keys, cookies,
authorization headers or presigned URLs. Build and log secret scans are release
gates.

## Rotation

1. Create the replacement credential with the same least privilege.
2. Store a new secret-manager version without changing source code.
3. Restart one staging instance with the new version and verify readiness,
   login, evidence upload/preview/delete and structured-log redaction.
4. Revoke the previous credential after the overlap window.
5. Record actor, timestamp, secret version identifiers and validation result;
   never record values.

Rotating `NEXTAUTH_SECRET` intentionally invalidates existing sessions and must
be announced to staging testers. Suspected exposure requires immediate revoke,
log review and incident handling rather than a routine overlap.

## Validation checklist

- Secret-manager references, not values, appear in deployment configuration.
- Final HTTPS origins match `NEXTAUTH_URL` and `APP_ORIGIN` exactly.
- A build-artifact scan finds none of the injected canary values.
- A request-log scan finds no cookie, credential or presigned URL.
- Old credentials fail after rotation and new credentials pass health/auth and
  evidence smoke tests.

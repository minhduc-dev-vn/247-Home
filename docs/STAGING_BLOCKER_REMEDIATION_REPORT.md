# 247 Home Staging Blocker Remediation Report

Report date: 2026-07-15, Asia/Bangkok

Scope: remediate STG-H-01 and standardize the deployment controls identified by
STG-H-02. No production deployment, business workflow, state machine or database
schema change was made.

## 1. Previous blockers

| Finding | Previous state | Remediation state |
|---|---|---|
| STG-H-01 Technician evidence upload fails in production mode | BLOCKING | FIXED; production-mode external E2E passes with S3-compatible provider |
| STG-H-02 HTTPS, secret manager and immutable artifact controls absent | BLOCKING | CONTRACT READY; platform provisioning remains a staging validation prerequisite |
| STG-M-03 dedicated database runbook absent | OPEN | FIXED; `DATABASE_RUNBOOK.md` added |

## 2. Root cause

Operations application code imported the local evidence implementation
directly. That implementation correctly rejected `NODE_ENV=production`, but no
provider-neutral port or staging provider existed. Therefore the database and
authorization path worked while the first evidence write returned HTTP 400.

The release documentation also described HTTPS, managed secrets and immutable
artifacts as preconditions without defining complete, reviewable contracts for
configuration, rotation, trusted forwarding headers, artifact identity,
retention and rollback.

## 3. Implementation

### Storage boundary

`src/modules/storage` now owns a `PrivateObjectStorage` port with `upload`,
`delete`, `getPrivateUrl`, `exists` and `download`. Operations obtains the port
from a factory and no longer knows the selected provider.

- `LocalStorageAdapter` remains development/test-only and independently rejects
  production mode.
- `S3ObjectStorageAdapter` supports AWS S3 and path-style S3-compatible
  providers. Objects are private by default because no public ACL is requested.
- Production fails closed unless `EVIDENCE_STORAGE_PROVIDER=s3` and all storage
  configuration passes strict validation.
- Object keys are generated server-side under `installation-evidence/`; user
  filenames never become paths or keys.
- JPEG, PNG and WebP MIME, extension, signature, strict base64 and 5 MiB decoded
  size are validated before provider I/O.
- SHA-256 is sent as object checksum/metadata and recorded in the audit event.
- Authorized preview downloads through the private provider client, checks the
  5 MiB bound and verifies byte length against database metadata. It exposes no
  physical path, provider credential or object URL.
- `getPrivateUrl` creates a short-lived SigV4 URL for provider integrations, but
  the current preview route remains an authorized server proxy.

### Persistence and cleanup

The object upload happens before the PostgreSQL transaction. Evidence row and
audit event commit together. If the transaction fails, `uploadAndPersist`
deletes the object. If cleanup also fails, both errors are retained in an
`AggregateError`; cleanup failure is not hidden.

No network call occurs inside the database transaction. A process crash between
object upload and transaction completion remains a distributed-system window;
staging must run bucket inventory reconciliation against database storage keys
and remove only reviewed, aged orphans. Normal error and fixture paths are
automatically cleaned and tested.

### HTTP behavior

Storage validation returns generic `400 VALIDATION_ERROR`. Provider or
configuration outage returns generic `503 STORAGE_UNAVAILABLE`. Existing Origin,
content type, request-size, rate-limit, authentication and assignment ownership
controls remain server-side.

## 4. Files changed

### Runtime

- `src/modules/storage/storage-interface.ts`
- `src/modules/storage/evidence-validation.ts`
- `src/modules/storage/local-storage-adapter.ts`
- `src/modules/storage/object-storage-adapter.ts`
- `src/modules/storage/storage-factory.ts`
- `src/modules/storage/index.ts`
- `src/modules/operations/application/operations-service.ts`
- `src/modules/operations/infrastructure/local-evidence-storage.ts`
- `src/shared/http/api-handler.ts`
- `src/shared/http/response.ts`
- `.env.example`
- `package.json`, `pnpm-lock.yaml`

### Tests and tooling

- `tests/unit/operations-evidence-storage.test.ts`
- `tests/unit/object-storage-adapter.test.ts`
- `tests/unit/storage-factory.test.ts`
- `tests/integration/operations.test.ts`
- `tests/fixtures/operations.ts`
- `tests/support/s3-compatible-test-server.ts`
- `playwright.staging.config.ts`

### Documentation

- `docs/STAGING_SECRET_MANAGEMENT.md`
- `docs/STAGING_INGRESS_CONFIGURATION.md`
- `docs/RELEASE_ARTIFACT_STRATEGY.md`
- `docs/DATABASE_RUNBOOK.md`
- `docs/STAGING_OPERATIONS_RUNBOOK.md`
- `docs/API_CONTRACT.md`
- `README.md`
- this report

## 5. Security impact

- Production local-file storage remains blocked.
- Provider configuration fails closed and no fallback silently enables local
  storage.
- Bucket objects are private and access uses scoped provider credentials or
  short-lived signed URLs.
- Filename traversal is rejected and user filenames are not used for object
  keys.
- Upload type, extension, signature and size checks are provider-independent.
- Preview authorization still requires Operations role or the owning
  Technician assignment; cross-Technician access remains 404.
- Database rows store only generated storage key, MIME, size, assignment owner
  relation and timestamps. Credentials and signed URLs are not persisted.
- Error responses and structured logs do not expose provider endpoints,
  credentials or signed URLs.

## 6. Production dependency review

Added exact versions:

- `@aws-sdk/client-s3@3.1087.0`
- `@aws-sdk/s3-request-presigner@3.1087.0`

They solve S3 API transport, SigV4 request signing, checksum headers, response
stream handling and time-limited URL signing. Node built-ins and existing
dependencies do not provide a reviewed S3 signer. A custom crypto/fetch adapter
was rejected because canonical request/signature edge cases would create a
larger security and maintenance burden.

The two direct packages add 26 resolved production packages. The production
audit covers 174 packages and found no moderate-or-higher advisory. AWS SDK v3
is vendor-maintained and Apache-2.0 licensed. Runtime scope is limited to the
server-side storage adapter. Rollback removes the S3 factory branch and these
dependencies while preserving the production fail-closed guard; stored evidence
must first be migrated or retained behind the previous compatible artifact.

## 7. Tests added and retained

- S3 upload command uses generated key, checksum metadata and no public ACL.
- SigV4 private URL has bounded expiry and does not contain the secret key.
- Traversal, MIME/extension mismatch, invalid signature and oversized input are
  rejected before provider I/O.
- Production cannot select local storage or omit S3 configuration.
- Persistence failure deletes the uploaded object; dual DB/delete failure
  preserves both errors.
- PostgreSQL integration verifies upload, audit transaction, manager preview,
  customer and cross-Technician denial, invalid MIME/size rejection and cleanup
  after transaction rollback.
- Existing Technician E2E completes ASSIGNED -> EN_ROUTE -> ARRIVED ->
  IN_PROGRESS -> COMPLETED, saves notes, uploads/previews evidence, updates the
  order and verifies audit events.
- External production-mode E2E uses the S3 adapter, one worker and zero retries.

## 8. Commands executed

| Command/check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS; lockfile current |
| `pnpm audit:prod` | PASS; 174 production packages, no moderate-or-higher advisory |
| `pnpm lint` | PASS; zero warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 18 files, 62 tests |
| `pnpm test:integration` | PASS; 7 files, 53 PostgreSQL tests |
| `pnpm test:migration` | PASS; valid upgrade and invalid-history rollback |
| `CI=1 pnpm test:e2e` | PASS; 14/14, one worker |
| `pnpm build` | PASS; optimized Next.js production build |
| `CI=1 pnpm test:e2e:staging` against external production process | PASS; 14/14, one worker, zero retries |
| Post-E2E object-provider residue | PASS; zero objects |
| Post-E2E database residue | PASS; zero fixture users and zero evidence rows |
| Production process health/readiness | PASS; HTTP 200/200 on loopback rehearsal |
| Structured-log credential/signed-URL scan | PASS; zero matches |

The staging Playwright run used explicit HTTP loopback opt-in solely for local
rehearsal. It does not satisfy the real HTTPS ingress check.

## 9. Remaining risks

1. The actual cloud secret manager, HTTPS ingress and artifact registry are not
   provisioned in this repository. Their contracts are ready, but staging must
   validate the real platform before receiving traffic.
2. The test S3-compatible server verifies signed private requests and object
   lifecycle behavior needed by E2E; an approved S3/MinIO staging service must
   repeat upload, preview, delete, encryption, policy and lifecycle checks.
3. An abrupt process death after object upload but before DB commit can leave an
   orphan. Provider inventory reconciliation and aged-orphan review are required
   operational controls; automatic request-error cleanup is already tested.
4. The artifact strategy is documented, but no registry digest or rollback
   image has yet been produced.
5. Shared rate limiting remains required before staging uses more than one
   application instance.

No Critical or High implementation finding remains in the remediation scope.
The platform requirements above are deployment gates, not waived risks.

## 10. Deployment requirements

Before changing status to `STAGING VALIDATED`, the release owner must:

1. Build and sign one immutable artifact and record target/rollback digests.
2. Inject database, Auth and storage credentials from the staging secret
   manager according to `STAGING_SECRET_MANAGEMENT.md`.
3. Provision a private S3-compatible bucket with prefix-scoped access,
   encryption, access logging and reviewed orphan lifecycle/reconciliation.
4. Configure HTTPS ingress and trusted forwarding behavior according to
   `STAGING_INGRESS_CONFIGURATION.md`.
5. Apply/verify migrations and backup/restore using `DATABASE_RUNBOOK.md`.
6. Run `pnpm test:e2e:staging` against the final HTTPS URL with zero retries and
   verify zero fixture/object residue.
7. Record health, cookie, headers, logs, alerts and rollback evidence in a new
   staging validation report.

## Decision

**STAGING VALIDATION READY**

The code package and operational contracts are ready for a new validation on an
approved staging platform. This is not `STAGING VALIDATED`, does not authorize
public traffic and does not authorize production deployment.

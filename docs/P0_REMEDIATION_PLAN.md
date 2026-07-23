# 247 Home P0 Remediation Plan

> Execution evidence is recorded separately in
> `P0_REMEDIATION_EVIDENCE.md`; this plan preserves the pre-execution finding
> and approval baseline.

## 1. Document Control

| Field | Value |
| --- | --- |
| Project | 247 Home |
| Purpose | Production remediation plan for High/P0 market-readiness blockers |
| Source of truth | `docs/MARKET_READINESS_REPORT.md` |
| Prepared against | Current repository state on `feature/auto-update` |
| Scope | Dependency security, distributed abuse controls, immutable staging deployment, secrets, recovery, VNPay sandbox/reconciliation, and release documentation |
| Excluded | New product features, business-rule changes, schema redesign, fake data, and P1/Medium cleanup |
| Overall status | **PENDING REMEDIATION** |

This document is an execution plan. It does not claim that any blocker has been
fixed merely because the repository already contains partial infrastructure or
documentation.

## 2. Executive Decision

247 Home must not be promoted to production until all P0 exit criteria in this
plan are met and their evidence is attached to a revision-specific release
record.

The repository already has a strong application baseline: server-side
authorization, optimistic concurrency, transactional order and inventory
operations, evidence authorization, infrastructure modules, release artifact
generation, and a VNPay implementation with signed callbacks. The remaining
P0 blockers are operational and supply-chain gaps that cannot be closed by code
inspection or local tests alone.

The recommended remediation sequence is:

1. Close the vulnerable production dependency.
2. make edge abuse protection authoritative and validate trusted client IP
   handling.
3. publish immutable runtime and migration images to ECR.
4. deploy those exact digests to a controlled AWS staging environment.
5. inject production-shaped secrets without exposing them to Terraform state or
   GitHub logs.
6. execute backup, restore, rollback, and object-storage lifecycle drills.
7. complete VNPay sandbox qualification and reconciliation monitoring.
8. reconcile canonical product and release documentation.

## 3. P0 Finding Matrix

| ID | High/P0 blocker from market report | Current evidence | Required end state | Expected status |
| --- | --- | --- | --- | --- |
| P0-01 | Vulnerable `sharp@0.34.5` production dependency | `pnpm why sharp` resolves through `next@16.2.10`; production audit reports GHSA-f88m-g3jw-g9cj | No High/Critical production advisory; Next image pipeline smoke-tested in the production container | Pending |
| P0-02 | In-memory rate limiter is not shared across replicas | `src/modules/identity/infrastructure/rate-limiter.ts` stores counters in a process-local `Map` | AWS WAF is the authoritative distributed limiter; trusted ingress/IP behavior is proven; local limiter remains defense in depth | Pending |
| P0-03 | No current-revision immutable staging deployment evidence | Workflow builds an immutable GHCR artifact, but AWS Terraform expects ECR/ECS and database migration is attempted from a GitHub runner | Runtime and migration images from one Git SHA are scanned, signed/provenanced, pushed to immutable ECR, and deployed by digest | Pending |
| P0-04 | Staging controls are designed but not proven | Terraform includes CloudFront, WAF, private RDS, encrypted S3, Secrets Manager, ECS, and alarms; no current execution record proves them | HTTPS, private database, secret injection, object authorization/lifecycle, logging, and smoke tests pass in real staging | Pending |
| P0-05 | Backup/restore/rollback evidence is missing | RDS backup and rollback documents exist; no current restore or rollback drill result | Pre-migration snapshot, isolated restore verification, and schema-compatible image rollback drill are completed and recorded | Pending |
| P0-06 | VNPay external readiness is unverified | Local signature, IPN, idempotency, transaction, and E2E tests exist; no real merchant sandbox evidence | Real sandbox success/failure/replay/tamper tests, reconciliation, alarms, and Finance/Security approval are recorded | Requires approval |
| P0-07 | Canonical release documentation contradicts implemented scope | README, scope/DoD, and historical staging reports describe different Warranty/VNPay states | One revision-specific release record links immutable artifacts, tests, approvals, known limitations, and superseded documents | Requires approval |

## 4. Change Safety and Backup Policy

Before modifying any critical file, create a non-destructive backup reference:

```powershell
git status --short
git rev-parse HEAD
git tag -a "pre-p0-remediation-YYYYMMDD" -m "Backup before P0 remediation"
git push origin "pre-p0-remediation-YYYYMMDD"
```

Additional controls:

- Never commit `.env`, secret values, Render/AWS database URLs, VNPay hash
  secrets, or generated credentials.
- Never reset, truncate, or reseed staging/production databases.
- Take and wait for an RDS snapshot before every migration-bearing deployment.
- Keep the previous schema-compatible runtime digest in the release manifest.
- Apply Terraform from reviewed plans. Store plans as protected CI artifacts
  without secret values.
- Use protected environments for staging and production. Production promotion
  requires an explicit human approval.
- Do not overwrite historical audit/readiness reports. Add a new
  revision-specific record and mark older reports as superseded where needed.

## 5. P0-01: Production Dependency Security

### Current finding

`sharp@0.34.5` is pulled by Next.js and is affected by the High-severity
libvips/sharp advisory for versions below `0.35.0`. The current latest compatible
Next.js line still declares `sharp` as `^0.34.5`, so upgrading Next.js alone does
not demonstrate remediation.

### Production-safe remediation

Add a reviewed pnpm override to the latest patched `0.35.x` release, update the
lockfile, and prove that Next.js image optimization works inside the exact
production container. This is a compatibility override, not a routine direct
dependency.

If the production image optimization smoke test fails, the release remains
blocked until Next.js officially supports the patched sharp line. Do not suppress
the audit finding and do not disable image optimization as a workaround.

### Files to update

| File | Change |
| --- | --- |
| `package.json` | Add an exact `pnpm.overrides.sharp` value after dependency review |
| `pnpm-lock.yaml` | Regenerate with pnpm; verify only intended dependency changes |
| `tests/e2e/image-runtime.spec.ts` | Add a production-runtime image optimization smoke test |
| `.github/workflows/ci.yml` | Preserve `pnpm audit:prod` as a blocking gate |
| `docs/DEPENDENCY_SECURITY_RECORD.md` | Record advisory, selected version, compatibility evidence, and rollback |

### Example configuration

```json
{
  "pnpm": {
    "overrides": {
      "sharp": "0.35.3"
    }
  }
}
```

The exact patched version must be rechecked immediately before implementation.

### Verification commands

```powershell
pnpm install
pnpm why sharp
pnpm audit:prod
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
docker build --target runtime -t 247-home:p0-sharp .
```

The container smoke test must request a real local product asset through
`/_next/image`, receive HTTP 200, return an image content type, and render
successfully at desktop and mobile widths.

### Rollback

Remove the override and restore the previous lockfile only if the patched sharp
line causes incompatibility. That rollback restores application behavior but
does not make the release eligible for production; P0-01 remains open.

### Exit criteria

- `pnpm audit:prod` has no High/Critical finding.
- Only one patched sharp version is present in the production graph.
- The production container serves optimized product images.
- Full quality gates pass.

**Expected status:** Fixed after implementation and evidence review.

## 6. P0-02: Distributed Rate Limiting and Trusted Ingress

### Current finding

The application limiter stores counters in a process-local `Map`. Multiple ECS
tasks therefore maintain independent limits. The Terraform WAF module already
contains rate rules, but the current authentication scope targets
`/api/v1/auth/`, while Auth.js credential callbacks also use `/api/auth/`.
Staging currently keeps the WAF action in count mode.

The application may also consume `x-forwarded-for` when proxy trust is enabled.
That header must not become an attacker-controlled rate-limit key.

### Selected architecture

Use AWS WAF on the only public CloudFront ingress as the authoritative
distributed IP limiter. Keep the process-local limiter as a secondary,
best-effort guard. Do not introduce Redis or another production dependency
unless Product and Security require a globally exact per-account quota.

The WAF rollout must use count mode for measured staging validation, followed by
an approved block-mode activation. Both `/api/auth/` and `/api/v1/auth/` must be
covered. Operations mutations and payment callback paths must have explicit
rules with thresholds appropriate to machine traffic.

### Files to update

| File | Change |
| --- | --- |
| `infrastructure/modules/waf/main.tf` | Cover actual Auth.js and API auth paths; add scoped mutation/payment rules and labels |
| `infrastructure/modules/waf/variables.tf` | Define reviewed thresholds and `count`/`block` actions |
| `infrastructure/environments/staging/main.tf` | Run count-mode soak, then select approved block mode |
| `infrastructure/environments/production/main.tf` | Require block mode for approved P0 routes |
| `infrastructure/modules/cloudfront/main.tf` | Ensure origin forwarding does not trust viewer-supplied client-IP headers |
| `src/shared/http/trusted-client.ts` | Centralize trusted proxy/client-IP extraction if application IP limits remain enabled |
| `src/shared/http/api-handler.ts` | Use the centralized trusted-client helper |
| `src/modules/payments/infrastructure/vnpay-webhook.ts` | Use the same trusted ingress contract without altering payment decisions |
| `tests/unit/shared/trusted-client.test.ts` | Prove spoofed forwarding headers are rejected or ignored |
| `scripts/verify-staging-rate-limit.ts` | Verify 429 behavior, `Retry-After`, spoof resistance, and direct-origin denial |
| `docs/RATE_LIMITING_RUNBOOK.md` | Record ownership, thresholds, emergency bypass, dashboards, and rollback |

### Terraform rule shape

```hcl
statement {
  rate_based_statement {
    aggregate_key_type = "IP"
    limit              = var.auth_rate_limit

    scope_down_statement {
      or_statement {
        statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/auth/"
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
        statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/v1/auth/"
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }
  }
}
```

Production code must use reviewed Terraform syntax for the installed AWS
provider version. The snippet describes the contract, not a copy-paste approval.

### Validation steps

1. Confirm the ALB accepts traffic only from CloudFront and requires the
   origin-verification header.
2. Deploy WAF rules in count mode.
3. Generate controlled requests against non-mutating or invalid test inputs.
4. Inspect WAF sampled requests and CloudWatch metrics for false positives.
5. Attempt to spoof `X-Forwarded-For`; verify it cannot reset or split quota.
6. Verify direct ALB access is denied.
7. Enable block mode through a reviewed Terraform plan.
8. Verify structured 429 responses and `Retry-After` behavior at the public
   origin.

### Rollback

Switch the affected WAF rule to count mode using an approved emergency change.
Do not remove the rule. Preserve logs and open an incident to tune the threshold.

### Approval

Security must approve:

- path coverage and thresholds;
- the trusted client-IP contract;
- count-to-block rollout evidence;
- any requirement for account-based distributed limiting.

**Expected status:** Fixed after block-mode staging proof and Security approval.

## 7. P0-03: Immutable Runtime and Migration Artifacts

### Current finding

The staging workflow already builds a tagged GHCR image, scans it, creates an
SBOM, and emits provenance. The selected AWS architecture, however, deploys ECS
from ECR. The workflow also attempts `prisma migrate deploy` from a
GitHub-hosted runner, which cannot be the production solution for private RDS.

### Selected architecture

Build two artifacts from the same Git SHA:

- **runtime image:** the current non-root Next.js standalone runtime;
- **migration image:** a minimal, non-root image containing pnpm, Prisma CLI,
  schema, and migrations, with `pnpm db:migrate` as its only release command.

Push both to immutable ECR repositories, scan both, attach SBOM/provenance, and
deploy by digest. Run migrations as a one-off ECS task in private subnets before
updating the runtime service.

### Files to update

| File | Change |
| --- | --- |
| `Dockerfile` | Add a dedicated non-root `migration` target; keep runtime target unchanged |
| `.github/workflows/staging-release.yml` | Authenticate with AWS OIDC, publish to ECR by digest, snapshot DB, run ECS migration task, deploy runtime digest, validate HTTPS |
| `.github/workflows/production-release.yml` | Promote the exact staging-approved digests after protected approval |
| `infrastructure/modules/ecr/*` | Confirm separate immutable runtime/migration repositories or clearly separated immutable tags |
| `infrastructure/modules/ecs/main.tf` | Add one-off migration task definition |
| `infrastructure/modules/ecs/variables.tf` | Accept migration image digest and restricted execution settings |
| `infrastructure/modules/ecs/outputs.tf` | Export task definition identifiers |
| `infrastructure/modules/platform/*` | Wire migration task, private subnets, security groups, and restricted secrets |
| `infrastructure/environments/staging/*` | Supply reviewed staging values and outputs |
| `infrastructure/environments/production/*` | Supply reviewed production values and outputs |
| `docs/RELEASE_ARTIFACT_STRATEGY.md` | Define paired artifacts, digest promotion, and evidence retention |
| `docs/MIGRATION_EXECUTION_DESIGN.md` | Mark dedicated ECS migration execution as implemented only after proof |

### Dockerfile target shape

```dockerfile
FROM dependencies AS migration
ENV NODE_ENV=production
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml ./
USER nextjs
CMD ["pnpm", "db:migrate"]
```

The implementation must reuse the actual user/group and dependency stage names
defined by the repository Dockerfile.

### Staging deployment sequence

```yaml
# Pseudocode: every third-party action must use a reviewed immutable commit SHA.
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@<REVIEWED_PINNED_SHA>

- name: Build paired artifacts
  run: |
    docker build --target runtime -t "$RUNTIME_IMAGE" .
    docker build --target migration -t "$MIGRATION_IMAGE" .

- name: Publish immutable images
  run: |
    docker push "$RUNTIME_IMAGE"
    docker push "$MIGRATION_IMAGE"

- name: Snapshot database
  run: ./scripts/create-rds-pre-migration-snapshot.ps1

- name: Run private migration task
  run: ./scripts/run-ecs-migration-task.ps1

- name: Deploy runtime digest
  run: ./scripts/deploy-ecs-runtime.ps1

- name: Validate staging
  run: pnpm test:e2e:staging
```

Do not seed staging or production. CI test databases remain disposable and may
use fixtures.

### Release manifest

Every deployment must publish a machine-readable manifest containing:

```json
{
  "gitSha": "<full-sha>",
  "runtimeImageDigest": "sha256:<digest>",
  "migrationImageDigest": "sha256:<digest>",
  "migrationChecksums": ["<checksum>"],
  "databaseSnapshotId": "<snapshot-id>",
  "previousRuntimeDigest": "sha256:<digest>",
  "sbomArtifacts": ["<artifact-reference>"],
  "provenanceArtifacts": ["<artifact-reference>"]
}
```

No secret value may appear in this manifest.

### Exit criteria

- ECR tag immutability and scan-on-push are enabled.
- Runtime and migration images have no High/Critical unaccepted findings.
- ECS task definitions reference image digests, not mutable tags.
- Migration executes inside the VPC against private RDS.
- Runtime and migration artifacts come from the same Git SHA.
- The release manifest, SBOM, provenance, and logs are retained.

**Expected status:** Fixed after a successful current-revision staging release.

## 8. P0-04: Secrets, HTTPS, Storage, and Production-Shaped Staging

### Current finding

Terraform already models CloudFront HTTPS, WAF, private RDS, encrypted and
versioned S3, ECS, Secrets Manager, and monitoring. The missing blocker is
execution evidence for the current revision. VNPay secrets are also not yet
represented in the ECS secret contract. The current task-role storage policy
must cover both installation and warranty evidence prefixes.

### Secret contract

Add the following secret identifiers to Secrets Manager and ECS runtime
injection:

- `DATABASE_URL`
- `AUTH_SECRET`
- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`

Use ordinary environment configuration for non-secret values:

- `AUTH_URL`
- `APP_ORIGIN`
- `VNPAY_PAYMENT_URL`
- `VNPAY_RETURN_URL`
- storage bucket name and region

The migration task receives only the database credential it needs. It must not
receive Auth, storage, SES, or VNPay secrets.

### Files to update

| File | Change |
| --- | --- |
| `infrastructure/modules/secrets/locals.tf` | Add VNPay secret definitions without secret versions |
| `infrastructure/modules/secrets/outputs.tf` | Export only secret ARNs/names |
| `infrastructure/modules/ecs/*` | Inject runtime secrets and keep migration task least-privileged |
| `infrastructure/modules/iam/*` | Allow only required secret ARNs and both evidence prefixes |
| `infrastructure/modules/s3/*` | Add reviewed lifecycle, access/audit telemetry, and inventory controls |
| `infrastructure/modules/cloudfront/*` | Enforce HTTPS redirect and current TLS policy |
| `infrastructure/modules/monitoring/*` | Add alarms for application, storage, payment callback, and task failures |
| `infrastructure/environments/staging/*` | Provide canonical HTTPS origins and non-secret VNPay sandbox URLs |
| `infrastructure/environments/production/*` | Provide canonical HTTPS origins and production endpoints only after approval |
| `docs/STAGING_SECRET_MANAGEMENT.md` | Document secret ownership, rotation, break-glass, and no-log rules |
| `docs/OBJECT_STORAGE_RUNBOOK.md` | Document prefixes, lifecycle, orphan reconciliation, and authorization checks |

### IAM resource contract

Runtime object permissions must be restricted to:

```text
arn:aws:s3:::<evidence-bucket>/installation-evidence/*
arn:aws:s3:::<evidence-bucket>/warranty-evidence/*
```

List access must be prefix-conditioned. Public ACLs and public bucket policies
remain blocked. Application responses expose authorized API preview URLs and
metadata, never physical S3 keys or filesystem paths.

### Storage lifecycle decision

Lifecycle retention is a Product/Legal decision because evidence may support
warranty, dispute, or regulatory processes. Until approved:

- keep versioning and encryption enabled;
- abort incomplete multipart uploads;
- retain current evidence objects;
- expire noncurrent versions only according to the approved recovery window;
- run an inventory/orphan report without deleting objects.

Deletion automation must not be enabled from this plan without written retention
approval.

### Staging validation

1. Validate DNS, ACM certificate, TLS, and HTTP-to-HTTPS redirect.
2. Verify CloudFront is the only public ingress and direct ALB requests fail.
3. Confirm RDS has no public endpoint and is reachable only by application and
   migration security groups.
4. Rotate staging secrets and redeploy without exposing values.
5. Upload and preview installation evidence through authorized APIs.
6. Upload and preview warranty evidence through owner-scoped APIs.
7. Verify cross-user and cross-technician evidence access is denied.
8. Verify logs contain request/resource identifiers but no secret, hash,
   credential, database URL, full payment payload, or unnecessary PII.
9. Run the orphan report and prove it is read-only.

### Exit criteria

- Public HTTPS and private origins are proven.
- Secret values never enter Git, Terraform state, workflow output, or artifacts.
- Storage authorization covers both evidence domains and denies IDOR.
- Lifecycle and retention have named owners and approval.
- Current-revision staging evidence is linked from the release record.

**Expected status:** Fixed after staging execution and Security/Product approval.

## 9. P0-05: Database Backup, Restore, and Rollback

### Current finding

The RDS module configures encryption, backup retention, and final-snapshot
controls. Database and rollback runbooks exist. A current-revision snapshot,
restore, and rollback drill has not been demonstrated.

### Required implementation

Add a protected release step that creates a pre-migration RDS snapshot and waits
until it is available. Add a manual recovery-drill workflow that restores the
snapshot to an isolated database, runs read-only integrity checks, records RPO
and RTO, and requires explicit approval before cleanup.

Runtime rollback may only select a previous digest proven compatible with the
current schema. Database rollback is forward-fix or restore-to-new-instance; it
must never use reverse destructive migrations, reset, truncate, or enum drops.

### Files to create or update

| File | Change |
| --- | --- |
| `scripts/create-rds-pre-migration-snapshot.ps1` | Create tagged snapshot, wait for availability, emit only snapshot ID |
| `scripts/run-ecs-migration-task.ps1` | Run task, wait, inspect container exit code, fail deployment on non-zero |
| `scripts/verify-database-invariants.ts` | Read-only post-migration checks |
| `scripts/deploy-ecs-runtime.ps1` | Update service by digest and wait for stability |
| `scripts/rollback-ecs-runtime.ps1` | Restore a schema-compatible previous runtime digest |
| `.github/workflows/staging-recovery-drill.yml` | Protected manual snapshot-restore exercise |
| `.github/workflows/staging-release.yml` | Add snapshot, migration, invariants, and rollback metadata |
| `docs/DATABASE_RUNBOOK.md` | Add exact current commands and forward-fix escalation |
| `docs/STAGING_ROLLBACK_PLAN.md` | Bind rollback to release manifest compatibility |
| `docs/STAGING_RECOVERY_DRILL_RECORD.md` | Record evidence, timestamps, RPO/RTO, and approvers |

### Invariant checker requirements

The script must be read-only and fail on:

- missing or failed Prisma migrations;
- unvalidated PostgreSQL constraints;
- impossible order/appointment state combinations;
- negative or inconsistent inventory allocations;
- duplicate active installation capacity allocation;
- unexpected current test-fixture namespaces.

It must not print customer PII, password hashes, tokens, payment signatures, or
evidence storage keys.

### Recovery drill sequence

1. Select the release snapshot from the manifest.
2. Restore to an isolated, encrypted RDS instance or cluster.
3. Attach a restricted security group accessible only by a one-off verifier.
4. run migration status and invariant checks.
5. execute read-only application smoke tests.
6. record start/end time, recovery point, recovery time, errors, and approvers.
7. preserve logs and evidence.
8. delete drill resources only after explicit approval and retention checks.

### Exit criteria

- Pre-migration snapshot creation is blocking and recorded.
- Restore succeeds without data loss outside the documented RPO.
- Integrity checks pass on the restored database.
- Previous compatible runtime digest rollback succeeds.
- Failed migration prevents runtime deployment.
- Recovery record is reviewed by Engineering and Operations.

**Expected status:** Fixed after a successful staging drill.

## 10. P0-06: VNPay Sandbox, Reconciliation, and Alerts

### Current finding

The application implements server-generated payment sessions, HMAC-SHA512
signatures, signed IPN validation, amount/order validation, idempotent callback
events, atomic payment/order/audit updates, and a read-only browser return
handler. Existing tests prove repository behavior, but they sign local requests
themselves and do not prove real VNPay merchant sandbox connectivity,
configuration, callbacks, settlement reconciliation, or operational alerts.

### Boundary

Do not change the payment/order state machine in this remediation. Add
environment validation, external qualification, read-only reconciliation, and
monitoring around the existing payment core.

### Files to create or update

| File | Change |
| --- | --- |
| `scripts/verify-vnpay-configuration.ts` | Fail closed on missing/mismatched environment configuration without printing secrets |
| `scripts/payment-reconciliation-report.ts` | Compare stale local sessions/payments with signed VNPay QueryDR responses; never mutate orders |
| `src/modules/payments/infrastructure/vnpay-query-client.ts` | Isolate QueryDR signing and response validation |
| `tests/unit/payments/vnpay-query-client.test.ts` | Verify canonical signing, signature rejection, amount/reference mapping |
| `tests/integration/payment-reconciliation.test.ts` | Verify read-only discrepancy and stale-session reporting |
| `infrastructure/modules/ecs/*` | Add a restricted scheduled reconciliation task definition |
| `infrastructure/modules/iam/*` | Give the task only required logs and VNPay secret access |
| `infrastructure/modules/monitoring/*` | Alarm on reconciliation failure/discrepancy, stale payments, callback 5xx, and task failure |
| `docs/VNPAY_SANDBOX_VALIDATION.md` | Record real provider test cases and evidence |
| `docs/PAYMENT_RECONCILIATION_RUNBOOK.md` | Define ownership, cadence, triage, manual correction, and escalation |
| `docs/PAYMENT_GATEWAY_DECISION.md` | Update external-readiness status after Finance/Security approval |

### Configuration verifier contract

The verifier must:

- require `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET`;
- require canonical HTTPS return and IPN origins outside local development;
- ensure sandbox URLs are used in staging and production URLs only in production;
- reject placeholder values;
- print names/status only, never values;
- exit non-zero on any mismatch.

### Reconciliation contract

The reconciliation process must:

- select bounded, indexed batches of stale `PaymentSession` or processing
  `Payment` rows;
- query VNPay using the provider-specified signed request;
- verify response signatures before trusting fields;
- compare transaction reference, amount, currency, and status;
- emit an allowlisted structured event for matches and discrepancies;
- alert on mismatches and repeated provider failures;
- never automatically update an order, capture a payment, or issue a refund;
- require the existing authoritative IPN or an approved manual operations
  procedure for state correction.

### Real sandbox qualification matrix

| Scenario | Required evidence |
| --- | --- |
| Successful payment | VNPay request ID, masked reference, signed IPN response, one payment transition, one audit event |
| Customer cancellation/failure | No paid order transition; session/payment state remains contract-compliant |
| Duplicate IPN | Idempotent response; no duplicate event, audit, or order transition |
| Delayed IPN | Correct processing after browser return; return route does not mutate state |
| Tampered signature | Request rejected and logged without sensitive payload |
| Amount/reference mismatch | Request rejected, no order/payment mutation, alert emitted |
| QueryDR reconciliation | Signed response verified and local/provider state compared |
| Provider outage | Retry/backoff remains bounded; alarm and runbook escalation occur |

### Operational alerts

Create CloudWatch metric filters and alarms for:

- payment callback 5xx rate;
- invalid signature rate anomaly;
- stale processing payments/sessions;
- reconciliation discrepancy count;
- reconciliation task failures;
- absence of expected reconciliation completion.

Alerts must route to the approved operations channel. Logs must not include card
data, secrets, signatures, full callback payloads, or unnecessary customer PII.

### Approval

The gateway remains disabled or hidden for production until:

- merchant onboarding is complete;
- Finance approves settlement and reconciliation procedures;
- Security approves secret handling and public callback tests;
- Operations owns alerts and incident response;
- Legal/Product approve customer-facing payment terms.

**Expected status:** Requires external validation and human approval.

## 11. P0-07: Canonical Release Documentation

### Current finding

Several documents describe older scope and staging states. Warranty and VNPay
implementation status is not consistently represented. Historical reports are
valuable evidence and must not be rewritten as if they described the current
revision.

### Files to update or create

| File | Change |
| --- | --- |
| `README.md` | Align supported modules, local/staging commands, and explicit production limitations |
| `docs/MVP_SCOPE_FREEZE.md` | Record approved scope changes or mark post-freeze additions |
| `docs/DEFINITION_OF_DONE.md` | Separate application-complete from production-ready gates |
| `docs/MARKET_READINESS_REPORT.md` | Preserve as the source audit; add a link to its remediation record only if desired |
| `docs/STAGING_DEPLOYMENT_RECORD_V2.md` | Current Git SHA, digests, migrations, snapshot, HTTPS tests, E2E, and approvers |
| `docs/STAGING_RECOVERY_DRILL_RECORD.md` | Actual restore/rollback evidence |
| `docs/PRODUCTION_RELEASE_CHECKLIST.md` | One release decision checklist with owners |
| `docs/decisions/ADR-*-production-rate-limiting.md` | Record WAF authority and any accepted shared-store requirement |

### Documentation rules

- Label historical reports as historical or superseded; do not overwrite their
  results.
- Link every pass claim to a command log, CI run, CloudWatch evidence, artifact
  digest, or approval.
- Use `PENDING` for unexecuted checks.
- Do not claim `PRODUCTION READY` from local tests.
- Record known limitations and explicit risk acceptance with owner and expiry.

### Exit criteria

- Product, Security, Finance, Legal, Engineering, and Operations sign-offs are
  explicit where applicable.
- The current release record references one Git SHA and exact image digests.
- No canonical document claims an unverified deployment or payment capability.

**Expected status:** Fixed after owner review and sign-off.

## 12. CI/CD Gate Changes

The release pipeline must fail closed in this order:

1. dependency install with frozen lockfile;
2. dependency audit;
3. lint and typecheck;
4. unit and integration tests on PostgreSQL;
5. build;
6. runtime and migration image build;
7. image vulnerability scan;
8. SBOM and provenance generation;
9. push immutable ECR digests;
10. pre-migration RDS snapshot;
11. private ECS migration task;
12. post-migration invariants;
13. runtime deployment by digest;
14. HTTPS health and staging E2E;
15. rate-limit, storage authorization, and payment callback probes;
16. publish revision-specific release record.

No step after a failed migration may deploy the runtime. Production uses digest
promotion from the staging-approved artifacts; it does not rebuild source.

### Required branch/environment protections

- Require review for infrastructure, workflow, migration, payment, and secret
  contract changes.
- Require all P0 gates before merge.
- Use GitHub OIDC instead of long-lived AWS access keys.
- Protect staging and production environments.
- Restrict production deployment approval to named release owners.
- Pin third-party actions to reviewed immutable commit SHAs.
- Prevent workflow logs and artifacts from containing secret values.

## 13. Complete File Manifest

The following is the expected remediation surface. Final implementation may
reuse existing files, but any scope expansion requires review.

### Dependency and runtime

```text
package.json
pnpm-lock.yaml
Dockerfile
tests/e2e/image-runtime.spec.ts
docs/DEPENDENCY_SECURITY_RECORD.md
```

### CI/CD and release

```text
.github/workflows/ci.yml
.github/workflows/staging-release.yml
.github/workflows/production-release.yml
.github/workflows/staging-recovery-drill.yml
scripts/create-rds-pre-migration-snapshot.ps1
scripts/run-ecs-migration-task.ps1
scripts/deploy-ecs-runtime.ps1
scripts/rollback-ecs-runtime.ps1
scripts/verify-database-invariants.ts
scripts/verify-staging-rate-limit.ts
```

### Infrastructure

```text
infrastructure/modules/waf/main.tf
infrastructure/modules/waf/variables.tf
infrastructure/modules/cloudfront/main.tf
infrastructure/modules/ecr/*
infrastructure/modules/ecs/*
infrastructure/modules/platform/*
infrastructure/modules/secrets/*
infrastructure/modules/iam/*
infrastructure/modules/s3/*
infrastructure/modules/monitoring/*
infrastructure/environments/staging/*
infrastructure/environments/production/*
```

### Application security boundary

```text
src/shared/http/trusted-client.ts
src/shared/http/api-handler.ts
src/modules/payments/infrastructure/vnpay-webhook.ts
tests/unit/shared/trusted-client.test.ts
```

### Payment operations

```text
scripts/verify-vnpay-configuration.ts
scripts/payment-reconciliation-report.ts
src/modules/payments/infrastructure/vnpay-query-client.ts
tests/unit/payments/vnpay-query-client.test.ts
tests/integration/payment-reconciliation.test.ts
docs/VNPAY_SANDBOX_VALIDATION.md
docs/PAYMENT_RECONCILIATION_RUNBOOK.md
docs/PAYMENT_GATEWAY_DECISION.md
```

### Release documentation

```text
README.md
docs/MVP_SCOPE_FREEZE.md
docs/DEFINITION_OF_DONE.md
docs/RELEASE_ARTIFACT_STRATEGY.md
docs/MIGRATION_EXECUTION_DESIGN.md
docs/DATABASE_RUNBOOK.md
docs/STAGING_ROLLBACK_PLAN.md
docs/STAGING_SECRET_MANAGEMENT.md
docs/OBJECT_STORAGE_RUNBOOK.md
docs/STAGING_DEPLOYMENT_RECORD_V2.md
docs/STAGING_RECOVERY_DRILL_RECORD.md
docs/PRODUCTION_RELEASE_CHECKLIST.md
docs/decisions/ADR-*-production-rate-limiting.md
```

## 14. Execution Phases

### Phase A: Repository-only remediation

Owner: Engineering and Security

1. Create the backup tag.
2. remediate sharp and prove runtime image compatibility.
3. implement paired runtime/migration artifacts.
4. correct WAF path coverage and trusted ingress handling.
5. add VNPay secret contracts and storage IAM prefixes.
6. implement read-only invariant/reconciliation scripts.
7. run all local and CI gates.

Exit: reviewed pull request, no High/Critical dependency or image finding, no
business-state-machine changes.

### Phase B: Controlled staging deployment

Owner: Release Engineering and Operations

1. Apply reviewed Terraform.
2. populate Secrets Manager out of band.
3. publish immutable images and evidence.
4. snapshot, migrate, verify, and deploy.
5. execute HTTPS, authorization, evidence, WAF, and full E2E probes.
6. publish `STAGING_DEPLOYMENT_RECORD_V2.md`.

Exit: current-revision staging deployment passes without manual database edits
or fake production data.

### Phase C: Recovery and payment qualification

Owner: Operations, Finance, Security

1. execute isolated restore and runtime rollback drills.
2. complete the VNPay real sandbox matrix.
3. run reconciliation and alert drills.
4. attach provider and CloudWatch evidence.
5. obtain required approvals.

Exit: all P0 findings are closed or an explicitly time-bounded residual risk is
approved by the named human owner. A High/Critical security finding cannot be
waived merely to meet a release date.

### Phase D: Production promotion

Owner: Release Manager

1. select the exact staging-approved runtime and migration digests.
2. confirm production secrets and DNS without exposing values.
3. create the pre-migration snapshot.
4. run private migration task and invariants.
5. deploy runtime digest.
6. execute production-safe smoke tests.
7. monitor WAF, application, database, storage, and payment alarms.
8. publish the production release record.

## 15. Required Commands and Evidence

### Repository gates

```powershell
pnpm install --frozen-lockfile
pnpm audit:prod
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm format:check
```

`format:check` currently represents a known P1 repository-baseline issue from
the market report. It must remain visible, but bulk formatting of unrelated
files is intentionally not part of this P0 plan. Lint failures introduced by P0
changes are blocking and must be fixed immediately.

### Infrastructure gates

```powershell
terraform -chdir=infrastructure/environments/staging fmt -check -recursive
terraform -chdir=infrastructure/environments/staging init -backend-config="<approved-backend-config>"
terraform -chdir=infrastructure/environments/staging validate
terraform -chdir=infrastructure/environments/staging plan -out=staging.tfplan
terraform -chdir=infrastructure/environments/staging show staging.tfplan
```

Use environment-specific approved commands and never pass secrets as Terraform
variables or CLI arguments.

### Artifact gates

```powershell
docker build --target runtime -t 247-home-runtime:$env:GITHUB_SHA .
docker build --target migration -t 247-home-migration:$env:GITHUB_SHA .
trivy image --severity HIGH,CRITICAL --exit-code 1 247-home-runtime:$env:GITHUB_SHA
trivy image --severity HIGH,CRITICAL --exit-code 1 247-home-migration:$env:GITHUB_SHA
```

CI should generate the authoritative SBOM and provenance using pinned reviewed
tools and retain their outputs with the release manifest.

### Staging evidence

Required attached evidence:

- Terraform plan/apply run and outputs without secrets;
- ECR repository immutability and image digests;
- vulnerability scan, SBOM, and provenance;
- RDS snapshot ID and migration ECS task exit code;
- database invariant result;
- ECS service stability and HTTPS health;
- staging Playwright report;
- WAF count/block metrics and spoof test;
- installation and warranty evidence authorization tests;
- recovery drill record;
- VNPay sandbox and reconciliation records;
- named approvals.

## 16. Approval Matrix

| Decision | Responsible approver | Blocking evidence |
| --- | --- | --- |
| sharp compatibility override | Engineering + Security | Audit clean, production image test, full gates |
| WAF thresholds and block mode | Security + Operations | Count-mode metrics, spoof/direct-origin tests |
| Evidence retention lifecycle | Product + Legal + Security | Retention policy and recovery requirement |
| Staging Terraform apply | Cloud/Release owner | Reviewed plan and change window |
| Database migration | Database/Release owner | Snapshot available, migration checksums |
| Recovery drill acceptance | Operations + Engineering | Restore checks, measured RPO/RTO |
| VNPay sandbox qualification | Finance + Security | Provider evidence and reconciliation |
| Production promotion | Release Manager | All P0 rows fixed and records complete |

## 17. Explicit Non-P0 Exclusions

The following items are not High/P0 in `MARKET_READINESS_REPORT.md` and must not
expand this remediation without a separately approved scope:

- bulk Prettier cleanup across the existing 86-file baseline;
- additional demo images or seed data;
- ProductImage or Warranty demo-seed improvements;
- broad all-role E2E expansion beyond tests required to prove a P0 control;
- general animation, accessibility, or Core Web Vitals improvements;
- refund automation;
- new order, operations, technician, warranty, or payment features;
- database architecture changes.

These items remain visible in the market-readiness backlog. P0 changes must not
make them worse.

## 18. Final P0 Exit Checklist

- [ ] Production dependency audit has no High/Critical finding.
- [ ] Runtime image optimization passes with the patched sharp version.
- [ ] AWS WAF is authoritative, in block mode, and covers real auth paths.
- [ ] Forwarded client-IP spoofing and direct-origin access are denied.
- [ ] Runtime and migration artifacts are immutable, scanned, and deployed by
      digest from the same Git SHA.
- [ ] Database migration runs in a private ECS task with least privilege.
- [ ] HTTPS, private RDS, secret injection, evidence authorization, and logging
      are proven in current-revision staging.
- [ ] Installation and warranty storage prefixes have least-privilege access and
      approved lifecycle rules.
- [ ] Pre-migration snapshot, isolated restore, and runtime rollback drills pass.
- [ ] VNPay real sandbox success/failure/replay/tamper cases pass.
- [ ] Reconciliation and payment alerts are operational and owned.
- [ ] Canonical release documentation matches the implemented revision.
- [ ] Product, Security, Finance, Legal, Engineering, Operations, and Release
      approvals are recorded where required.
- [ ] Full repository, infrastructure, image, staging, and release gates pass.

## 19. Final Status

**P0 REMEDIATION PLAN COMPLETE**

**Production status: BLOCKED pending execution and evidence.**

This plan provides one production-safe path: AWS CloudFront/WAF to ECS with
immutable ECR runtime and migration artifacts, private RDS, encrypted private S3,
Secrets Manager, tested recovery, and qualified VNPay operations. No alternative
deployment strategy is proposed for P0 closure.

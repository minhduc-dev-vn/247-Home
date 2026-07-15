# Staging Infrastructure Ready Report

Report timestamp: 2026-07-15T16:52:00+07:00  
Scope: repository-owned infrastructure preparation and local artifact evidence

## Executive decision

**STAGING INFRASTRUCTURE BLOCKED**

**BLOCKED BY EXTERNAL INFRASTRUCTURE**

The repository now contains a buildable, scanned, non-root container artifact,
an immutable source checkpoint, a fail-closed publish/deploy workflow, and
complete staging setup/rollback contracts. No Git remote, registry publication,
cloud account, staging URL, managed PostgreSQL, secret-manager binding, private
object store, or current/previous deployed digest was available. Localhost,
local PostgreSQL, test credentials and test S3 were not counted as staging.

## 1. Release identity

| Check | Result | Evidence |
|---|---|---|
| Original release checkpoint | PASS | `v0.1.0-staging` -> `c5d940ef97191e4aa3937fd269d9f5c8ac33399f` |
| Infrastructure source checkpoint | PASS | `v0.1.0-staging-infra.2` -> `acffda86453aea9a1ba40aedddd7d49a0d6a6ca4` |
| Clean source at artifact build | PASS | `git status --porcelain` was empty before build |
| Approved remote/tag protection | BLOCKED | `git remote -v` is empty; tags exist only in this checkout |

The original tag was preserved and never moved. See `RELEASE_CHECKPOINT.md`.

## 2. Artifact

| Field | Value |
|---|---|
| Local image tag | `247-home:v0.1.0-staging-infra.2` |
| Local OCI image ID | `sha256:30c3c798c27c1a7a62343daf2996ec137b73ebd711bbbe5668797cbb7b614d94` |
| Git revision label | `acffda86453aea9a1ba40aedddd7d49a0d6a6ca4` |
| Version label | `v0.1.0-staging-infra.2` |
| Created label | `2026-07-15T16:48:01+07:00` |
| Runtime user | `nextjs` |
| Approximate local image size | `103580682` bytes |
| Health/readiness | `ok` / `ready`; Docker health `healthy` |
| Trivy Critical/High | `0` |
| Registry digest | **NOT AVAILABLE**; image was not pushed |

The Dockerfile pins the Node base-image digest, upgrades patched Alpine
packages, generates Prisma Client before Next build, copies standalone runtime
output only, removes package managers, runs non-root and defines a liveness
healthcheck. Runtime image history contained no `.env`, database/Auth/storage
secret marker. See `ARTIFACT_RELEASE_PROCESS.md`.

## 3. Deployment architecture

The target architecture is HTTPS ingress -> one digest-pinned Next.js container
-> private PostgreSQL 16 and private S3-compatible object storage. Development
Compose and localhost are excluded. Network, isolation, probes and telemetry are
defined in `STAGING_ARCHITECTURE.md`.

**Result: CONTRACT READY; DEPLOYMENT BLOCKED.** No cloud platform or account was
bound, so no container was deployed outside the local artifact smoke test.

## 4. Database

- Local `pnpm db:migrate`: PASS; 11 migrations, no pending migration.
- PostgreSQL integration tests: PASS, 53 tests.
- Migration-upgrade test: PASS, including invalid-history rejection/rollback.
- Staging PostgreSQL 16, split migration/runtime roles, TLS binding: MISSING.
- Real staging backup and isolated restore evidence: MISSING.
- Real staging invariant output: MISSING.

Provisioning, migration, invariant, backup and restore procedure is in
`STAGING_DATABASE_SETUP.md`. Local database results are application/artifact
evidence only.

## 5. Secrets

Required vault bindings and least-privilege ownership are documented in
`STAGING_SECRET_SETUP.md` and `STAGING_CI_CD.md`. No required staging environment
name was present in the operator process and no approved secret provider was
available. A random local Auth value used for container smoke was ephemeral and
does not count as a secret-manager binding.

**Result: BLOCKED.**

## 6. Storage

The private bucket, encryption, prefix-scoped identity and evidence-lifecycle
validation are defined in `STAGING_STORAGE_SETUP.md`. No real staging bucket,
object or IAM/workload identity was available. No mock/test S3 result was used
as staging evidence.

**Result: BLOCKED.**

## 7. HTTPS ingress

DNS, TLS, trusted-proxy stripping, secure cookies, origin checks, forwarding
spoof tests and direct-port denial are defined in `STAGING_INGRESS_SETUP.md`.
`STAGING_BASE_URL` was absent. `pnpm test:e2e:staging` was not run because its
required real HTTPS target does not exist; loopback rehearsal was deliberately
not substituted.

**Result: BLOCKED.**

## 8. CI/CD

`.github/workflows/staging-release.yml` provides:

- immutable staging-tag validation;
- frozen install and all quality gates;
- local OCI build followed by a SHA-pinned Trivy scanner gate;
- CycloneDX SBOM generation before publication;
- GHCR publication by non-`latest` tag, digest capture, and signed
  provenance/SBOM attestations;
- protected-environment migration with a separate credential;
- exact-digest platform deploy hook;
- post-deploy HTTPS Playwright validation.

Actionlint 1.7.12 passed. All third-party actions are pinned to commit SHAs.
The workflow has not run because this checkout has no remote/GitHub repository
binding or environment secrets.

## 9. Rollback

The non-destructive plan is in `STAGING_ROLLBACK_PLAN.md`: retain current and
previous compatible digests, back up before migration, roll application back by
digest, and recover database through isolated restore/forward fix. No previous
registry artifact and no real staging backup exist, so rollback cannot yet be
exercised.

**Result: PLAN READY; EXECUTION BLOCKED.**

## 10. Commands and results

| Command/check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm audit:prod` | PASS; 174 production packages, no moderate-or-higher advisory |
| `pnpm db:migrate` | PASS locally; 11 migrations, none pending |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 62/62 |
| `pnpm test:integration` | PASS; 53/53 on PostgreSQL |
| `pnpm test:migration` | PASS |
| `pnpm test:e2e` | PASS; 14/14, one worker, no retry |
| `pnpm build` | PASS |
| `docker build ... 247-home:v0.1.0-staging-infra.2` | PASS from clean detached tagged worktree |
| Immutable container `/api/health` | PASS |
| Immutable container `/api/ready` | PASS using local PostgreSQL smoke dependency |
| Docker healthcheck/non-root | PASS; `healthy`, user `nextjs` |
| Trivy 0.70.0 image scan | PASS; 0 fixable Critical/High |
| Actionlint 1.7.12 | PASS |
| `pnpm test:e2e:staging` | NOT RUN; no real HTTPS staging URL |

Lockfile SHA-256:
`7bd48b0e6a905ad076e5dac40ddb43278b74271c43d84e0e0158913e2e83a3c1`.

Ordered 11-migration manifest SHA-256:
`ac43ae08e369603b3e20600fecd25e523af4491074f861749a664e9c1ce689d5`.

## External infrastructure checklist

- [ ] Configure the approved Git remote and protect immutable release tags.
- [ ] Push `acffda86453aea9a1ba40aedddd7d49a0d6a6ca4` and
      `v0.1.0-staging-infra.2`; run trusted tag CI.
- [ ] Enable GHCR immutability/retention and record the published image digest.
- [ ] Provision the HTTPS staging hostname, certificate and isolated container
      platform; configure `STAGING_BASE_URL`.
- [ ] Provision PostgreSQL 16 with separate migration/runtime roles and TLS.
- [ ] Bind runtime and workflow secrets from an approved secret manager.
- [ ] Provision a private encrypted logged S3-compatible bucket and scoped
      runtime identity.
- [ ] Create and verify a pre-migration backup plus isolated restore drill.
- [ ] Record current and previous compatible registry digests.
- [ ] Run the protected deploy job, real ingress/storage/database checks and
      `pnpm test:e2e:staging` against the deployed digest.
- [ ] Exercise application rollback and repeat health/auth/checkout/Operations
      smoke tests.
- [ ] Produce Staging Validation v2 evidence and obtain human approval.

## Remaining blockers

| ID | Severity | Blocker |
|---|---|---|
| `STG-REL-H-01` | High | Release tags and commit are not present in an approved protected remote |
| `STG-ART-H-01` | High | Local artifact exists, but no registry digest/SBOM/provenance run is published |
| `STG-INF-H-01` | High | No real HTTPS staging deployment |
| `STG-SEC-H-01` | High | No approved runtime secret-manager binding |
| `STG-DB-H-01` | High | No staging PostgreSQL/backup/restore evidence |
| `STG-STO-H-01` | High | No real private staging object storage |
| `STG-RBK-H-01` | High | No previous registry digest or staging backup to exercise rollback |

Do not claim `STAGING VALIDATED`. After the external checklist is complete,
rerun all release jobs and create a new Staging Validation v2 report tied to the
deployed registry digest.

# Staging Artifact Validation

Validation attempt: `2026-07-15T09:02:22Z`

## Result

**BLOCKED: missing immutable deployment artifact.**

| Requirement | Result | Evidence |
|---|---|---|
| Clean source tree | FAIL | Runtime, dependency, test and documentation changes are uncommitted |
| Approved Git SHA | FAIL | HEAD `904655f` does not contain the remediation working tree |
| Release version | FAIL | No release version or candidate tag assigned |
| Artifact version | FAIL | No artifact manifest exists |
| OCI image digest | FAIL | No `247-home`/`home247` image is present |
| Registry location | FAIL | No remote, registry config or publishing workflow exists |
| Build timestamp | FAIL | No immutable artifact build record exists |
| Lockfile checksum | PASS AS SOURCE ONLY | `7bd48b0e6a905ad076e5dac40ddb43278b74271c43d84e0e0158913e2e83a3c1` |
| Migration checksum | PASS AS SOURCE ONLY | `ac43ae08e369603b3e20600fecd25e523af4491074f861749a664e9c1ce689d5` |
| Previous rollback artifact | FAIL | No previous digest or registry object identified |

`Dockerfile` is absent. Docker Compose defines local PostgreSQL only. CI runs
quality gates but has no image build, signing, registry push or staging deploy
job. There are zero Git tags and zero configured Git remotes.

## Required action

1. Human-review and commit the remediation as a release candidate.
2. Add and review the artifact build/publish implementation described by
   `RELEASE_ARTIFACT_STRATEGY.md`.
3. Run trusted CI from the approved commit.
4. Publish once to the approved registry, generate provenance/SBOM/signature,
   and record `registry/repository@sha256:<digest>`.
5. Retain a previous schema-compatible digest for rollback.
6. Deploy by digest, never `latest` or another mutable tag.

No application artifact was built or deployed during this validation attempt.

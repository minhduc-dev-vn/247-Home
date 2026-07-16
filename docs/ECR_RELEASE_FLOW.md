# ECR Release Flow

Status: **DESIGN READY, ECR EXECUTION NOT VERIFIED**  
Date: 2026-07-15

## 1. Release chain

```text
Reviewed immutable Git tag
  -> full quality gates
  -> Docker build from the tagged commit
  -> Trivy Critical/High gate
  -> CycloneDX SBOM and provenance
  -> ECR push through GitHub OIDC
  -> registry sha256 digest
  -> staging Terraform input
  -> staging validation
  -> same manifest digest promoted to production ECR
  -> production Terraform input
```

No environment rebuilds the application image. Tags are labels; deployment
identity is `repository@sha256:<digest>`.

## 2. Current repository state

The existing staging workflow publishes to GHCR and has not run against an
approved remote. Terraform creates ECR repositories with immutable tags,
scan-on-push, KMS encryption and lifecycle policies. The ECR-specific workflow
binding remains blocked until AWS accounts, OIDC roles and repositories exist.

## 3. Build and security gates

Before push:

1. Verify the release tag points at the checked-out commit.
2. Run frozen install, dependency audit, lint, typecheck, unit, PostgreSQL
   integration, migration-upgrade, E2E and build gates.
3. Build the existing non-root standalone runtime image with no environment
   secret.
4. Scan OS and library packages. Fixable Critical/High findings block publish.
5. Generate SBOM, source SHA, lockfile checksum, migration checksum and build
   provenance.

The workflow uses GitHub OIDC for ECR login. It never receives an AWS access key.

## 4. ECR controls

- Tag immutability enabled.
- Scan on push enabled; organization-level enhanced scanning is reviewed
  separately.
- KMS encryption enabled.
- Lifecycle retains at least current and previous compatible digests.
- Repository write allowed only to the release role.
- Runtime execution role has pull only.
- Manual developer push is denied by default.
- CloudTrail records repository policy, lifecycle and image mutation attempts.

## 5. Digest capture and promotion

After push, CI obtains the registry digest from ECR and records:

- release tag and Git SHA;
- ECR repository URI and digest;
- scan result and timestamp;
- SBOM/provenance identities;
- migration manifest checksum;
- workflow run and actor.

Production uses cross-account ECR replication or an approved digest-preserving
copy. CI verifies the destination manifest digest equals the staging-qualified
digest before Terraform can reference it.

## 6. Terraform handoff

`container_image` validation rejects mutable tags. A protected `.tfvars` source
contains only the destination ECR URI plus verified digest. The plan reviewer
compares it with the release record and rejects any rebuild or digest mismatch.

## 7. Rollback

Retain the previous schema-compatible digest. Rollback updates ECS to that exact
digest while retaining the forward database schema. Do not move a tag, rebuild
an old commit or reverse migrations by deleting data.

## 8. Exit criteria

Artifact flow is ready only after a real protected workflow publishes a scanned
staging image through OIDC, captures the ECR digest, verifies attestations,
replicates the same digest to production and exercises digest-based rollback.

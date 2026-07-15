# Release Artifact Strategy

Version: 2026-07-15

## Decision

247 Home will use a build-once, deploy-many OCI image produced from a reviewed
Git commit. This document defines the handoff; it does not claim that a registry
or production deployment currently exists.

## Identity

Each artifact has:

- immutable registry digest, such as `sha256:<digest>`;
- human-readable release version, such as `247-home-v0.1.0-rc.1`;
- full Git commit SHA and clean-tree assertion;
- Node and pnpm versions;
- lockfile checksum and migration checksum manifest;
- software bill of materials and production dependency audit result;
- build timestamp and CI run identity.

Tags are discovery labels only. Deployments pin the digest, never a mutable tag.

## Build process

1. Check out the approved commit in trusted CI with read-only repository access.
2. Run `pnpm install --frozen-lockfile`, audit, lint, typecheck, unit,
   integration, migration, E2E and build gates.
3. Build the runtime image without staging or production secrets.
4. Run as a non-root user with a read-only root filesystem and a writable temp
   directory only where Next.js requires it.
5. Generate SBOM, provenance and SHA-256 digest; sign the digest with the
   approved CI identity.
6. Push once to the approved registry and prohibit tag mutation/deletion except
   through audited retention workflow.
7. Deploy the exact digest to staging, then promote that same digest. Do not
   rebuild per environment.

The reviewed implementation is `Dockerfile` plus
`.github/workflows/staging-release.yml`; operational commands and bindings are
defined in `ARTIFACT_RELEASE_PROCESS.md` and `STAGING_CI_CD.md`. Docker Compose
remains local development tooling and is not the release artifact.

## Storage and retention

- Registry encryption, access logs, malware scanning and signature verification
  are mandatory.
- CI may push; staging runtime may pull; developers do not receive registry
  write credentials by default.
- Keep every staging candidate for at least 30 days and every production
  artifact for the approved business retention period.
- Keep at least the current and previous schema-compatible artifacts available
  for immediate rollback.

## Rollback

Before deployment, record current and target digests. Application rollback pins
the previous compatible digest while retaining the forward database schema.
Never rebuild an old tag or reverse a migration by deleting data. If the new
release has written incompatible data, stop writes and follow the database
forward-fix/restore procedure in `DATABASE_RUNBOOK.md`.

Rollback verification includes artifact signature/digest, migration
compatibility, readiness, auth, checkout and Operations smoke tests. The release
record identifies the owner who can approve rollback.

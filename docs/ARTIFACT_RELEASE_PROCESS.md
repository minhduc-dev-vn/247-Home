# Artifact Release Process

## Artifact contract

247 Home uses a build-once, deploy-many OCI image. Tags are discovery labels;
deployments and rollback records always use `registry/repository@sha256:digest`.
The tag `latest` is prohibited.

Required identity:

- release tag and semantic application version;
- full Git SHA from a clean, tagged commit;
- OCI image digest;
- UTC build timestamp;
- OCI revision/version/created labels;
- SBOM and provenance produced by BuildKit.

## Local reproducibility check

This command creates an inspectable local artifact. It does not publish or
validate staging:

```powershell
$sha = git rev-parse HEAD
$created = (Get-Date).ToUniversalTime().ToString('o')
docker build --pull `
  --build-arg APP_VERSION=v0.1.0-staging-infra.1 `
  --build-arg GIT_SHA=$sha `
  --build-arg BUILD_TIMESTAMP=$created `
  --tag 247-home:v0.1.0-staging-infra.1 .
```

The runtime stage contains Next.js standalone output only, runs as `nextjs`,
and receives all environment-specific values at runtime. Public builder-only
placeholders use `.invalid` endpoints and are not runtime credentials.

## Trusted release

`.github/workflows/staging-release.yml` checks out an existing `v*-staging*`
tag, reruns every quality gate, publishes to
`ghcr.io/<owner>/<repository>:<release-tag>`, records the digest, emits SBOM and
provenance, and fails on Critical/High image findings. The deploy job passes the
exact digest to the staging platform. It never deploys a mutable tag.

Registry requirements:

- tag immutability and deletion protection;
- CI-only push permission; runtime pull-only permission;
- access/audit logs and encrypted storage;
- minimum 30-day staging retention;
- current and previous schema-compatible digests retained;
- artifact manifest retained with the CI run.

## Rollback artifact

Before deployment, copy the active digest to the release record as
`previous_digest`. Verify its schema compatibility and pullability. Rollback
selects that digest; it does not rebuild an old tag or reverse migrations.


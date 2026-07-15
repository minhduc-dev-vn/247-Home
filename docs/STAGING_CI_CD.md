# Staging CI/CD

## Workflow

The release workflow is `.github/workflows/staging-release.yml`.

1. Check out and verify an immutable `v*-staging*` tag.
2. Install from the frozen pnpm lockfile.
3. Run dependency audit, migrations, seed in the disposable CI database, lint,
   typecheck, unit, integration, migration-upgrade, E2E, and build gates.
4. Build once and publish an OCI image to GHCR with SBOM/provenance.
5. Scan the digest with SHA-pinned Trivy 0.70.0 and fail on fixable
   Critical/High CVEs.
6. On an explicit manual deployment, migrate the staging database using the
   migration credential, call the platform deploy hook with the exact digest,
   then run HTTPS staging E2E.

All third-party actions are pinned to reviewed commit SHAs and jobs use minimum
permissions. Pull requests do not receive staging credentials.

## Required GitHub configuration

Create a protected GitHub Environment named `staging`, require release-owner
approval, and configure:

| Binding | Kind | Purpose |
|---|---|---|
| `STAGING_BASE_URL` | Environment variable | Final HTTPS origin |
| `STAGING_MIGRATION_DATABASE_URL` | Environment secret | Migration role only |
| `STAGING_DEPLOY_HOOK` | Environment secret | Approved platform deployment endpoint |
| `STAGING_DEPLOY_TOKEN` | Environment secret | Least-privilege hook credential |

Runtime database/Auth/storage values belong to the deployment platform secret
manager, not the GitHub build job. The hook contract accepts JSON containing
only `image` (including digest) and `release`; it must reject tags without a
digest and wait until the selected revision is healthy.

## Trigger

1. Push the reviewed immutable tag to the approved remote.
2. Let tag CI publish and scan the artifact.
3. Run `Staging release` manually with that same tag and
   `deploy_staging=true`.
4. Approve the protected environment after checking current/previous digests,
   database backup, and maintenance window.

Missing bindings fail the workflow before migration/deploy. A green artifact
job without a green deploy and staging validation job is not staging success.

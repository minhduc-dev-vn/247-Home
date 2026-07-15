# Release Checkpoint

Checkpoint created: 2026-07-15T16:18:56+07:00

| Field | Value |
|---|---|
| Branch | `main` |
| Commit | `c5d940ef97191e4aa3937fd269d9f5c8ac33399f` |
| Tag | `v0.1.0-staging` |
| Working tree | Clean when checkpoint was created and verified |
| Commit subject | `chore: prepare staging release after audit remediation` |

## Scope

The checkpoint contains the application, security remediation, PostgreSQL
migrations, Operations tests, staging validation contracts, and S3-compatible
storage adapter. The tag existed before this infrastructure task and was not
moved or rewritten.

Container and CI/CD preparation is a later reviewable change. It must receive a
new immutable tag rather than changing `v0.1.0-staging`.

## Current infrastructure artifact checkpoint

| Field | Value |
|---|---|
| Commit | `acffda86453aea9a1ba40aedddd7d49a0d6a6ca4` |
| Tag | `v0.1.0-staging-infra.2` |
| Commit timestamp | `2026-07-15T16:48:01+07:00` |
| Local OCI image | `247-home:v0.1.0-staging-infra.2` |
| Local OCI image ID | `sha256:30c3c798c27c1a7a62343daf2996ec137b73ebd711bbbe5668797cbb7b614d94` |

The infrastructure tag points at the clean source used for the local artifact.
It does not replace the original checkpoint. A registry digest is not available
until trusted CI publishes this tag to the approved remote/GHCR repository.
The earlier `v0.1.0-staging-infra.1` tag remains immutable but is superseded
because `infra.2` moves the security scan before registry publication.

## Verification

```powershell
git rev-list -n 1 v0.1.0-staging
git show -s --format='%H%n%aI%n%s' v0.1.0-staging
git status --short --branch
```

No Git remote is configured in this checkout. A release owner must configure
the approved repository and protect release tags before registry publication.

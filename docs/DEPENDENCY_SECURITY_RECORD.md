# Dependency Security Record

## Remediation

On 2026-07-23 the production graph was moved from Next.js 16.2.10 to 16.2.11
and `sharp` was pinned to 0.35.3 through the pnpm workspace override. pnpm was
upgraded to 11.16.0 and vulnerable transitive build-tool versions were pinned.

The runtime and migration images use the same lockfile. The migration image
removes pnpm, npm, Corepack, and Yarn after installation and calls Prisma/tsx
through Node, reducing its runtime attack surface.

## Evidence

- `pnpm audit:prod`: PASS, 180 production packages, no moderate-or-higher
  advisory.
- `pnpm why sharp`: one resolved version, `sharp@0.35.3`.
- Runtime image Trivy scan: 0 High, 0 Critical.
- Migration image Trivy scan: 0 High, 0 Critical.
- Runtime health and Next image optimization smoke: HTTP 200.
- Runtime process identity: UID/GID 1001, non-root.

Exact local image IDs are recorded in `P0_REMEDIATION_EVIDENCE.md`. Registry
digests must be recorded after the CI workflow publishes to ECR; local image IDs
are not substitutes for registry digests.

## Rollback

Application and lockfile changes must be rolled back together. A rollback that
reintroduces a High/Critical advisory is not eligible for release.

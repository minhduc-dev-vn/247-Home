# Phase 5 Execution Report

- **Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
- **Executed:** 2026-08-01
- **Scope:** Phase 5 - restore reliable catalog media and catalog availability

## Status

**PHASE 5 REPOSITORY REMEDIATION COMPLETE. REAL STAGING OBJECT-STORAGE QUALIFICATION PENDING OWNER.**

The original failure mode is resolved in the repository. Tracked demo images are
served as release assets from `public/assets/images/products/`; persisted
`ProductImage` data is now stored only through a private S3-compatible adapter
in production and is streamed by a server endpoint after an active-product
authorization check. A legacy local key no longer overrides a static demo image
and produces a broken card in a production container.

This is not a claim that a remote Render/S3-compatible staging environment has
been qualified. No staging origin, bucket, runtime identity, or owner approval
was available in this checkout. The exact commands and evidence still required
for that external step are in [`OBJECT_STORAGE_RUNBOOK.md`](OBJECT_STORAGE_RUNBOOK.md).

## Root Cause and Resolution

| Requirement | Implementation | Regression evidence | Result |
| --- | --- | --- | --- |
| Distinguish static from persisted media | `catalog:media-audit` classifies each active product as release-static, persisted, or unconfigured without writing data | `pnpm catalog:media-audit -- --limit 100 --strict`: 12 static products, 48/48 files present, no unknown rows | PASS |
| Static image available after clean production-like build | Docker runtime copies `public/`; release revision is available to `/api/health` | Rebuilt Compose app: health revision `92423cf0593a`; direct image returned `200`, `image/png`, `Cache-Control: public, max-age=0` | PASS (local production-like) |
| Persisted catalog image avoids container filesystem | `product-image-storage.ts` uses `createCatalogImageStorage`; production rejects the local provider and requires S3-compatible configuration | `storage-factory.test.ts`; `catalog-media.test.ts` | PASS |
| Logical keys only | Generated keys have the `catalog-images/<uuid>.<extension>` form; API DTOs and audits exclude storage keys and provider detail | `catalog-media.test.ts`: safe DTO and audit assertions | PASS |
| Public preview has server-side policy | `GET /api/v1/product-images/{id}` serves only images on `ACTIVE` products and returns `404` for draft, legacy, missing, or unavailable objects | `catalog-media.test.ts`; `catalog-media.spec.ts` | PASS |
| Legacy local rows do not break cards | `catalog-service.ts` exposes only managed catalog keys. Legacy/bare keys are omitted so known demo slugs use their static fallback | `catalog-media.test.ts`: `does not let a legacy local key override the static catalog fallback` | PASS |
| MIME, extension, signature, and size validation | Shared private-image validator accepts JPEG/PNG/WebP only and enforces a decoded 2 MiB catalog-image limit before I/O | `catalog-image-storage.test.ts`; `catalog.test.ts` | PASS |
| Failed metadata persistence has no orphan object | Upload is followed by metadata plus audit in one transaction; `uploadAndPersist` compensates with provider deletion if it fails | `catalog-media.test.ts`: database failure leaves S3-compatible object count unchanged | PASS |
| Existing demo seed is explicit and non-destructive | No seed is triggered by `prisma migrate deploy`; local/staging seed boundaries are documented and no existing catalog row is rewritten | `OBJECT_STORAGE_RUNBOOK.md`; existing guarded seed commands | PASS |

## Implementation Boundaries

`POST /api/v1/admin/products/{id}/images` authorizes the actor before object
upload, validates the payload, stores the private object, then persists
`ProductImage` metadata and a `catalog.product-image-created` audit event in the
same database transaction. If the transaction fails, the uploaded object is
deleted; a failed cleanup is surfaced rather than ignored.

`GET /api/v1/product-images/{id}` looks up an active product image before
downloading it. It streams bytes with the stored MIME type,
`Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, and a cache
header. It never returns a filesystem path, object key, bucket, endpoint,
presigned URL, or credential.

No Prisma migration was needed. `ProductImage` already has the required
`storageKey`, `mimeType`, and `byteSize` columns. Existing rows are not reset,
deleted, or rewritten; unknown/legacy keys require the catalog-owner migration
procedure in the object-storage runbook.

## Files Changed for Phase 5

- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.env.demo.example`
- `package.json`
- `src/modules/storage/storage-interface.ts`
- `src/modules/storage/evidence-validation.ts`
- `src/modules/storage/storage-factory.ts`
- `src/modules/storage/local-storage-adapter.ts`
- `src/modules/storage/object-storage-adapter.ts`
- `src/modules/catalog/application/catalog-service.ts`
- `src/modules/catalog/infrastructure/local-image-storage.ts`
- `src/modules/catalog/infrastructure/product-image-storage.ts`
- `app/api/v1/admin/products/[id]/images/route.ts`
- `app/api/v1/product-images/[id]/route.ts`
- `scripts/catalog-media-audit.ts`
- `scripts/verify-catalog-media-deployment.ts`
- `tests/support/s3-compatible-test-server.ts`
- `tests/unit/catalog-image-storage.test.ts`
- `tests/unit/storage-factory.test.ts`
- `tests/integration/catalog.test.ts`
- `tests/integration/catalog-media.test.ts`
- `tests/fixtures/catalog-media.ts`
- `tests/e2e/catalog-media.spec.ts`
- `docs/API_CONTRACT.md`
- `docs/DATABASE_DESIGN.md`
- `docs/OBJECT_STORAGE_RUNBOOK.md`
- `docs/CURRENT_SYSTEM_REMEDIATION_PLAN.md`
- `docs/PHASE_5_EXECUTION_REPORT.md`

Some listed files were already modified in the dirty worktree before Phase 5.
This phase adds only the catalog-media storage, route, test, verification, and
documentation changes described here; it does not revert unrelated work.

## Verification

| Command / evidence | Result |
| --- | --- |
| `pnpm db:migrate` | PASS - 17 migrations; no pending migration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 39 files, 196 tests |
| `pnpm test:integration` | PASS - 13 PostgreSQL-backed files, 109 tests |
| `pnpm test:migration` | PASS - valid upgrade plus invalid-history rollback checks |
| `pnpm build` | PASS |
| `pnpm test:e2e` | PASS - 51 tests from a fresh source server after the final migration; no retry was used |
| Focused production-like persisted-media E2E | PASS - `catalog-media.spec.ts` against the rebuilt Docker app and local private MinIO bucket |
| `pnpm catalog:media-audit -- --limit 100 --strict` | PASS - 12 static demo products, no missing assets, no persisted/legacy rows left after fixtures |
| `pnpm catalog:verify-deployed-media -- --origin http://127.0.0.1:3000 --expected-revision 92423cf0593af171bce094ca43185cbe81ef50a7` | PASS - local production-like app reports the expected revision and serves the direct static image |
| Touched-file Prettier check | PASS |
| `git diff --check` | PASS - no whitespace errors |
| `pnpm format:check` | FAIL - 72 pre-existing files outside Phase 5; Phase 5 files pass targeted formatting |

The local Docker artifact used image digest
`sha256:01013cb0a3ec51c6c63c73d79f354b0e4ca8d9e596b5351402331afecb936b81`
and OCI revision
`92423cf0593af171bce094ca43185cbe81ef50a7`. This proves a local
production-like build, not a published remote artifact.

## Required Staging Evidence and Approval

Before H-05 can be closed as a real staging/release result, the release owner
must do the following without recording secrets:

1. Configure a private S3-compatible bucket, provider encryption/lifecycle,
   public-access block, and a prefix-scoped runtime identity for
   `catalog-images/*`.
2. Set `CATALOG_IMAGE_STORAGE_PROVIDER=s3` and the approved secret references in
   the staging service; do not set a local provider in production.
3. Deploy a reviewed SHA and run the two `catalog:verify-deployed-media` commands
   in `OBJECT_STORAGE_RUNBOOK.md` against the HTTPS staging origin, including an
   approved active persisted-image fixture.
4. Attach redacted output, deployment SHA, provider access-log evidence, draft
   image `404`, failed-write cleanup proof, and rollback/retention approval to
   the release record.
5. Obtain Security, Product, and service-owner approval before migrating any
   `LEGACY_OR_UNKNOWN` image row or enabling catalog uploads on production.

## Residual Risks

1. **Remote storage remains unverified.** The code fails closed, but a real
   provider bucket/IAM/HTTPS path cannot be certified without the owner-managed
   staging configuration and evidence above.
2. **Legacy persisted images need an owner-approved forward migration.** They
   intentionally do not render through the new endpoint. Known demo products
   fall back to tracked static media; other legacy products need recovered source
   files rather than an automatic rewrite.
3. **Global formatting is still red.** `pnpm format:check` reports 72 unrelated
   existing files. It remains a Phase 7 release-quality item.
4. **Prisma configuration deprecation remains.** The `package.json#prisma`
   warning is unchanged and tracked for Phase 7 before Prisma 7.
5. **The current worktree is not a release artifact.** This report proves the
   present local checkout. Commit/review it, then repeat the staging verification
   for the promoted SHA.

## Conclusion

Phase 5 is complete at the repository and local production-like level: static
catalog media is present, persisted media is private and adapter-backed,
metadata/audit writes are compensating, legacy keys no longer break catalogue
cards, and current migration/unit/integration/E2E/build evidence passes. The
project must not claim a real staging or production media-provider qualification
until the owner-run evidence matrix and approvals above are complete.

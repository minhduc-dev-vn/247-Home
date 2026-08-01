# Object Storage Runbook

- **Scope:** persisted catalog images and existing private installation/warranty evidence.
- **Status:** repository controls implemented; real staging-provider verification requires the service owner.

## Storage Model

| Media class | Source | Delivery | Storage visibility |
| --- | --- | --- | --- |
| Tracked demo product images | `public/assets/images/products/` | Direct static asset URL | Public release artifact |
| Persisted catalog image | `ProductImage.storageKey` with `catalog-images/` prefix | `GET /api/v1/product-images/{id}` after active-product lookup | Private S3-compatible object, streamed by application |
| Installation/warranty evidence | Evidence tables with evidence prefixes | Owner/assignment-authorized endpoint | Private S3-compatible object |

The database stores a logical key only. Public catalog DTOs, upload responses,
audit payloads, and application logs must not contain a storage key, local path,
presigned URL, bucket name, endpoint, or credential. Persisted catalog images
are public only after their product is `ACTIVE`; a draft image requested by ID
returns `404`.

## Configuration

Use the existing S3-compatible variables for endpoint, region, and identity.
Catalog images may use the evidence bucket with a distinct prefix, or a separate
bucket through `CATALOG_IMAGE_STORAGE_BUCKET`.

```text
CATALOG_IMAGE_STORAGE_PROVIDER=s3
CATALOG_IMAGE_STORAGE_BUCKET=<optional-private-catalog-bucket>
STORAGE_BUCKET=<private-bucket-when-catalog-bucket-is-omitted>
STORAGE_REGION=<provider-region>
STORAGE_ENDPOINT=<only-for-approved-S3-compatible-endpoints>
STORAGE_ACCESS_KEY=<only-for-custom-endpoint>
STORAGE_SECRET_KEY=<only-for-custom-endpoint>
STORAGE_FORCE_PATH_STYLE=false
```

For native AWS S3, omit `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, and
`STORAGE_SECRET_KEY`; the AWS SDK uses the workload identity chain. Custom
S3-compatible endpoints require a paired access/secret key and fail closed if
only one is present. In production `CATALOG_IMAGE_STORAGE_PROVIDER=local` is
rejected. Do not add any values to Git, browser environment variables,
screenshots, or support tickets.

The local Compose demo uses MinIO with `CATALOG_IMAGE_STORAGE_PROVIDER=s3` and a
private bucket. Normal `pnpm dev` and tests use a local adapter only outside
production.

## IAM and Bucket Policy

The runtime identity needs only `GetObject`, `PutObject`, `HeadObject`, and
`DeleteObject` for `catalog-images/*` and separately approved evidence prefixes.
It must not grant anonymous read, ACL changes, bucket-policy changes, lifecycle
changes, list access outside its assigned prefix, or cross-environment access.
Enable provider-side encryption, public-access blocking, versioning where
available, lifecycle retention, and data-access logging before staging use.

## Upload and Preview Behavior

1. An authorized catalog actor sends image bytes, filename, MIME type, and alt text.
2. The application validates JPEG/PNG/WebP extension, signature, strict base64,
   and the 2 MiB decoded catalog-image limit before provider I/O.
3. The adapter writes a generated `catalog-images/<uuid>.<extension>` object.
4. The catalog transaction creates metadata and its audit record. If either write
   fails, the application deletes the object; a cleanup failure is surfaced for
   operator investigation rather than ignored.
5. The public image endpoint loads only an image belonging to an active product,
   then streams the object with MIME, `nosniff`, and public cache headers. It never
   returns a filesystem path, bucket key, or provider URL.

## Non-destructive Existing-Row Migration Plan

No database migration, reset, truncate, or automatic data rewrite is part of
this release. Existing `ProductImage` rows are classified before any catalog
owner changes data:

1. Take the provider-approved database backup/snapshot and record the release SHA.
2. Run the read-only audit with a bounded page:

   ```powershell
   pnpm catalog:media-audit -- --limit 100
   pnpm catalog:media-audit -- --limit 100 --verify-objects --strict
   ```

3. Leave products with no `ProductImage` row on their tracked static fallback.
4. Treat a `catalog-images/` key as managed only after object verification passes.
5. Treat a bare UUID, legacy local key, malformed key, or missing object as
   `LEGACY_OR_UNKNOWN`; do not rewrite it automatically or call it renderable.
6. A catalog owner must recover the approved source image. A separately reviewed
   forward utility may upload the replacement, update metadata, write an audit
   event, and retain the old object until rollback approval. That utility is not
   executed by `prisma migrate deploy` or any seed command.
7. After an approved change, rerun the audit and deployed-media verification.

The audit output exposes only a one-way digest of each storage key. It is safe to
attach to a release record after normal redaction review.

## Seed Boundary

`prisma migrate deploy` never seeds catalog data. `pnpm db:seed` is restricted
to local development. `pnpm db:seed:staging` requires the explicit Render staging
host, `SEED_TARGET=staging`, confirmation marker, and a strong staging-only demo
password. It must not run against production and it does not upload or replace
persisted catalog images. Static demo imagery remains a tracked release artifact.

## Deployment Verification

After deploying the reviewed SHA, use a public HTTPS origin and a product image
ID belonging to an approved active fixture only:

```powershell
pnpm catalog:verify-deployed-media -- --origin https://staging.example.test --expected-revision <release-sha>
pnpm catalog:verify-deployed-media -- --origin https://staging.example.test --expected-revision <release-sha> --product-image-id <active-image-cuid>
```

The command verifies `/api/health` revision metadata, one direct static image's
HTTP status, `Content-Type`, and `Cache-Control`, and optionally the persisted
image proxy endpoint. Record redacted command output, deployment SHA, request
IDs for failed requests, and provider object-count evidence. Never record a
presigned URL or storage credential.

## Rollback and Recovery

Rollback application code to the previous reviewed SHA without deleting bucket
objects or database rows. Do not fall back to local filesystem storage in
production. Delete an object only after confirming it is unreferenced and
retention/rollback policy permits it. A provider outage is an availability
incident: keep metadata intact, return the generic storage error for uploads,
and restore provider access before retrying.

## Required Staging Evidence

- Private bucket, public-access block, and encryption configuration.
- Prefix-scoped runtime identity proof for `catalog-images/*`.
- Static direct-asset response with deployed revision.
- Authorized persisted image preview and draft-image `404`.
- Invalid MIME, extension, size, and traversal rejections.
- Persistence-failure cleanup and object-count proof.
- Recovery/rollback owner and retention/lifecycle approval.

Until this evidence exists, this repository is not authorized to claim that a
real staging or production catalog-media provider is verified.

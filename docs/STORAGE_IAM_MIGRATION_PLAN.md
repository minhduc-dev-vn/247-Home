# Storage IAM Migration Plan

Decision: **OPTION A, AWS SDK DEFAULT CREDENTIAL PROVIDER CHAIN**  
Implementation status: **REPOSITORY REMEDIATION COMPLETE**  
Cloud verification: **PENDING**  
Date: 2026-07-15

## 1. Problem

Terraform assigns least-privilege S3/KMS permissions to the ECS application task
role, but the application previously required `STORAGE_ACCESS_KEY` and
`STORAGE_SECRET_KEY`. That would force a long-lived IAM access key into Secrets
Manager and bypass the approved workload-identity model.

Option B was rejected because it increases rotation, leakage and incident
surface without adding capability on native AWS S3.

## 2. Implemented behavior

For native AWS S3:

```text
ECS task metadata credential endpoint
  -> AWS SDK default credential provider chain
  -> short-lived task-role credentials
  -> private S3 bucket and KMS key
```

The application supplies no explicit SDK credentials when
`STORAGE_ENDPOINT` is absent. The AWS SDK resolves and refreshes task-role
credentials.

Custom S3-compatible endpoints remain supported for local/test. They must supply
both access and secret key; a partial pair or unsigned custom endpoint fails
closed.

## 3. Files changed

- `src/modules/storage/storage-factory.ts`: static keys optional for AWS S3,
  paired validation for custom endpoints.
- `src/modules/storage/object-storage-adapter.ts`: optional explicit credential
  object; omission activates the SDK provider chain.
- `tests/unit/storage-factory.test.ts`: ambient credential and fail-closed tests.
- `tests/unit/object-storage-adapter.test.ts`: explicit test-endpoint credential
  shape.
- `infrastructure/modules/ecs/locals.tf`: removed static storage key injection.

No business storage key, MIME, size, authorization, cleanup or path validation
changed.

## 4. IAM contract

The task role may:

- list only `installation-evidence/*`;
- get, put and delete objects only under that prefix;
- use only the environment data KMS key;
- send SES mail only for the approved identity after the adapter exists.

It cannot modify bucket policy, public access, ACL, encryption, lifecycle or
another environment's objects. Terraform creates no IAM user or access key.

## 5. Tests

Required repository tests:

- native AWS configuration succeeds without static keys;
- custom endpoint with both test keys remains supported;
- one missing key is rejected;
- custom endpoint without credentials is rejected;
- upload, private preview, validation and cleanup tests remain green;
- TypeScript and production build pass.

Required staging tests after deployment:

1. ECS task metadata provides the application role.
2. Evidence upload, head, preview and delete pass.
3. Access outside `installation-evidence/*` is denied.
4. Cross-environment bucket access is denied.
5. Removing task-role S3 permission causes a clear provider failure.
6. Task definition and Secrets Manager contain no static storage key.
7. CloudTrail S3 data events identify the task role.

## 6. Rollout

1. Publish and scan the remediated immutable image.
2. Remove static storage keys from staging secret/task definitions.
3. Deploy one staging task with the task role.
4. Run the positive and negative tests above.
5. Roll all staging tasks only after evidence passes.
6. Promote the same digest and policy to production.

## 7. Rollback

Rollback uses the previous image digest only in staging while preserving bucket
data. It must not create a permanent IAM user automatically. Production launch
is blocked rather than falling back silently to static credentials.

## 8. Residual risk

Repository tests prove configuration selection, not the AWS metadata endpoint or
real IAM policy. Cloud verification is still mandatory. Product-image storage is
a separate adapter and remains a production launch gate.

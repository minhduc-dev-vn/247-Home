# Staging Object Storage Setup

## Bucket contract

Provision a real S3-compatible bucket dedicated to staging evidence. It must be
private, encrypted at rest, versioned where supported, access-logged, lifecycle
managed, and unreachable by anonymous/public ACL or bucket policy.

The runtime identity is prefix-scoped and may only `PutObject`, `GetObject`,
`HeadObject`, and `DeleteObject` for the staging evidence prefix. It cannot
change policy, ACL, encryption, lifecycle or logging. Prefer workload identity;
otherwise bind short-lived/rotatable credentials through the secret manager.

Set `EVIDENCE_STORAGE_PROVIDER=s3` in staging. Do not use local/mock storage,
and do not expose filesystem paths or public object URLs.

## Validation

Using synthetic data only:

1. Log in as the assigned Technician through the HTTPS staging URL.
2. Upload an allowed evidence image within the configured size limit.
3. Confirm one private object, one database evidence row and the expected audit
   events exist.
4. Preview through the authorized application endpoint.
5. Confirm another Technician and an anonymous request cannot preview it.
6. Complete the appointment and verify order/appointment state.
7. Exercise a database-persistence failure and verify uploaded-object cleanup.
8. Delete the fixture and confirm neither object nor database residue remains.

Retain request IDs and redacted object key hashes, not presigned URLs or access
keys. The repository test S3 server is useful for adapter tests but cannot count
as this evidence.

No real staging bucket or identity is available in the current environment.


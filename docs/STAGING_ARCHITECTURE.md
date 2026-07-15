# Staging Architecture

## Target topology

```text
User
  |
  | HTTPS (TLS 1.2+, staging DNS)
  v
Managed ingress / load balancer
  |
  | private application network
  v
247 Home container pinned by OCI digest
  |                         |
  | TLS                     | HTTPS, private bucket credentials/workload identity
  v                         v
PostgreSQL 16             S3-compatible private object storage
```

The application runs one replica until the process-local rate-limit strategy is
replaced by a shared backend. The application port is not internet-accessible.
PostgreSQL and object storage accept only the required runtime/migration
identities. Application, database, and logs use UTC.

## Isolation

- Staging has distinct DNS, database, bucket, encryption keys, service
  identities and secrets from development and production.
- `docker-compose.yml`, localhost, local PostgreSQL and mock storage are never
  staging components.
- Egress is restricted to PostgreSQL, object storage, DNS, time, and explicitly
  approved platform endpoints.
- Runtime filesystem is read-only except platform temp space; evidence is never
  persisted to the container filesystem.
- Logs are access-controlled and redact cookies, credentials, request bodies,
  addresses, phone numbers and presigned URLs.

## Availability and telemetry

Ingress probes `/api/health`; rollout readiness probes `/api/ready`. Alert on
failed rollout, repeated readiness failure, process restart, HTTP 5xx, unusual
429 volume, database saturation and object-storage errors. Every deployment
record contains release tag, Git SHA and exact image digest.

No provider account is bound in this repository checkout. This document is the
approved target contract, not evidence that the topology exists.


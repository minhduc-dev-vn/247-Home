# 247 Home Documentation

- **Status:** Current
- **Last reviewed:** 2026-08-01
- **Supported deployment:** Local Docker and single-instance Render staging

This directory contains only maintained specifications, runbooks, release
status and accepted architecture decisions. Historical audits, implementation
reports, screenshots and cloud rehearsal evidence remain available from Git
history rather than the current tree.

## Reading order

1. [`../AGENTS.md`](../AGENTS.md)
2. [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md)
3. [`MVP_SCOPE_FREEZE.md`](MVP_SCOPE_FREEZE.md)
4. [`USER_FLOWS.md`](USER_FLOWS.md)
5. [`ARCHITECTURE.md`](ARCHITECTURE.md)
6. [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md)
7. [`API_CONTRACT.md`](API_CONTRACT.md)
8. [`ORDER_STATE_MACHINE.md`](ORDER_STATE_MACHINE.md) and
   [`INSTALLATION_STATE_MACHINE.md`](INSTALLATION_STATE_MACHINE.md)
9. [`THREAT_MODEL.md`](THREAT_MODEL.md)
10. [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md)

## Canonical specifications

| Document | Purpose |
| --- | --- |
| [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) | Product scope and priorities |
| [`MVP_SCOPE_FREEZE.md`](MVP_SCOPE_FREEZE.md) | Approved MVP boundary |
| [`USER_FLOWS.md`](USER_FLOWS.md) | Customer, admin and technician journeys |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Modular-monolith boundaries and runtime design |
| [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) | Data model, constraints and concurrency invariants |
| [`API_CONTRACT.md`](API_CONTRACT.md) | HTTP endpoints, payloads and errors |
| [`ORDER_STATE_MACHINE.md`](ORDER_STATE_MACHINE.md) | Order lifecycle and side effects |
| [`INSTALLATION_STATE_MACHINE.md`](INSTALLATION_STATE_MACHINE.md) | Appointment and technician lifecycle |
| [`TIMESTAMP_POLICY.md`](TIMESTAMP_POLICY.md) | Time storage and display rules |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Trust boundaries and security controls |
| [`UI_DESIGN_SYSTEM.md`](UI_DESIGN_SYSTEM.md) | Frontend tokens and component conventions |
| [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) | Required engineering quality gates |

## Runbooks

| Document | Purpose |
| --- | --- |
| [`LOCAL_DEMO_RUNBOOK.md`](LOCAL_DEMO_RUNBOOK.md) | Start, reset and verify the local Docker demo |
| [`RENDER_STAGING_RUNBOOK.md`](RENDER_STAGING_RUNBOOK.md) | Deploy the supported low-cost Render staging profile |
| [`DATABASE_RUNBOOK.md`](DATABASE_RUNBOOK.md) | Migration, seed, backup and forward-fix procedures |
| [`OBJECT_STORAGE_RUNBOOK.md`](OBJECT_STORAGE_RUNBOOK.md) | Catalog and evidence object storage |
| [`OPERATIONS_MIGRATION_RUNBOOK.md`](OPERATIONS_MIGRATION_RUNBOOK.md) | Operations migration recovery |
| [`PAYMENT_RECONCILIATION_RUNBOOK.md`](PAYMENT_RECONCILIATION_RUNBOOK.md) | Payment reconciliation |
| [`RATE_LIMITING_RUNBOOK.md`](RATE_LIMITING_RUNBOOK.md) | Rate-limit configuration and validation |
| [`VNPAY_SANDBOX_VALIDATION.md`](VNPAY_SANDBOX_VALIDATION.md) | VNPay sandbox qualification gates |
| [`SECURITY_INCIDENT_AND_RECOVERY.md`](SECURITY_INCIDENT_AND_RECOVERY.md) | Credential and security incident response |

## Decisions and status

| Document | Purpose |
| --- | --- |
| [`RELEASE_READINESS_RECORD.md`](RELEASE_READINESS_RECORD.md) | Current release status and external blockers |
| [`ADR-001`](decisions/ADR-001-identity-local-credentials.md) | Identity credentials and session baseline |
| [`ADR-002`](decisions/ADR-002-production-rate-limiting.md) | Production rate-limiting policy |
| [`ADR-014`](decisions/ADR-014-vnpay-online-payment.md) | VNPay integration boundary |
| [`ADR-015`](decisions/ADR-015-password-reset-delivery-outbox.md) | Transactional password-reset delivery outbox |

## Deployment policy

- Local development and demonstrations use Docker Compose, PostgreSQL and
  MinIO.
- Public testing uses the single-instance Render profile in the Render runbook.
- Vercel is not a supported deployment target for this repository.
- AWS infrastructure code is retained under `infrastructure/`, but AWS
  provisioning is deferred and its old rehearsal reports are not maintained.
- VNPay remains disabled for public use until every sandbox gate passes.

## Maintenance rules

- Update a canonical document instead of creating a new task-specific report.
- Use `ADR-NNN-short-title.md` only for durable architectural decisions.
- Keep command output, screenshots and temporary evidence outside Git or in the
  external CI/release system.
- Never commit secrets, database dumps, customer data, build output, local logs
  or test traces.
- Use repository-relative links and run the documentation link check before
  merging documentation changes.
- Git history is the archive for superseded audits and execution reports.

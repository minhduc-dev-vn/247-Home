# 247 Home Documentation Guide

- **Status:** Current
- **Last reviewed:** 2026-08-01
- **Purpose:** Canonical navigation and document lifecycle rules for `docs/`.

## Source-of-truth order

When documents disagree, use this order:

1. Security and data-safety requirements in [`AGENTS.md`](../AGENTS.md).
2. Accepted architecture decisions in [`decisions/`](decisions/).
3. Current product, architecture, database, API, state-machine and threat-model
   documents listed below.
4. Current remediation and release-readiness records.
5. Point-in-time audit, implementation and execution reports.

Reports describe what was observed or executed at a specific revision. They do
not override current contracts or accepted ADRs.

## Start here

| Document | Status | Purpose |
| --- | --- | --- |
| [`../README.md`](../README.md) | Current | Project overview and local setup |
| [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) | Canonical | Product requirements and priorities |
| [`MVP_SCOPE_FREEZE.md`](MVP_SCOPE_FREEZE.md) | Canonical | Approved MVP scope boundary |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Canonical | Modular-monolith boundaries and runtime architecture |
| [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) | Canonical | Data model, constraints and concurrency invariants |
| [`API_CONTRACT.md`](API_CONTRACT.md) | Canonical | HTTP contracts and error semantics |
| [`ORDER_STATE_MACHINE.md`](ORDER_STATE_MACHINE.md) | Canonical | Order transitions and side effects |
| [`INSTALLATION_STATE_MACHINE.md`](INSTALLATION_STATE_MACHINE.md) | Canonical | Appointment and technician transitions |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Canonical | Trust boundaries and security controls |
| [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) | Canonical | Required quality gates |

## Current remediation and release state

| Document | Purpose |
| --- | --- |
| [`CURRENT_SYSTEM_AUDIT_REPORT.md`](CURRENT_SYSTEM_AUDIT_REPORT.md) | Findings that initiated the current remediation program |
| [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md) | Approved Phase 1-7 remediation plan |
| [`PHASE_1_TO_7_REASSESSMENT.md`](PHASE_1_TO_7_REASSESSMENT.md) | Consolidated status after all seven phases |
| [`RELEASE_READINESS_RECORD.md`](RELEASE_READINESS_RECORD.md) | Current local release-gate record and external blockers |
| [`MARKET_READINESS_REPORT.md`](MARKET_READINESS_REPORT.md) | Broader market-readiness assessment |

Phase evidence is retained as an audit trail:

- [`PHASE_1_EXECUTION_REPORT.md`](PHASE_1_EXECUTION_REPORT.md)
- [`PHASE_2_EXECUTION_REPORT.md`](PHASE_2_EXECUTION_REPORT.md)
- [`PHASE_3_EXECUTION_REPORT.md`](PHASE_3_EXECUTION_REPORT.md)
- [`PHASE_4_EXECUTION_REPORT.md`](PHASE_4_EXECUTION_REPORT.md)
- [`PHASE_5_EXECUTION_REPORT.md`](PHASE_5_EXECUTION_REPORT.md)
- [`PHASE_6_EXECUTION_REPORT.md`](PHASE_6_EXECUTION_REPORT.md)
- [`PHASE_7_EXECUTION_REPORT.md`](PHASE_7_EXECUTION_REPORT.md)

## Operations and local runbooks

| Document | Purpose |
| --- | --- |
| [`LOCAL_DEMO_RUNBOOK.md`](LOCAL_DEMO_RUNBOOK.md) | Start, reset and verify the local demo |
| [`DATABASE_RUNBOOK.md`](DATABASE_RUNBOOK.md) | Migration, seed, verification and recovery procedures |
| [`OBJECT_STORAGE_RUNBOOK.md`](OBJECT_STORAGE_RUNBOOK.md) | Local and S3-compatible object-storage operation |
| [`RATE_LIMITING_RUNBOOK.md`](RATE_LIMITING_RUNBOOK.md) | Rate-limit configuration and validation |
| [`PAYMENT_RECONCILIATION_RUNBOOK.md`](PAYMENT_RECONCILIATION_RUNBOOK.md) | Payment reconciliation procedure |
| [`RENDER_STAGING_RUNBOOK.md`](RENDER_STAGING_RUNBOOK.md) | Current low-cost Render staging workflow |
| [`SECURITY_INCIDENT_AND_RECOVERY.md`](SECURITY_INCIDENT_AND_RECOVERY.md) | Credential and security incident response |
| [`OPERATIONS_MIGRATION_RUNBOOK.md`](OPERATIONS_MIGRATION_RUNBOOK.md) | Operations migration forward-fix guidance |

## Architecture decisions

ADR numbers are unique and accepted decisions remain immutable except for
status/supersession annotations.

| ADR | Decision |
| --- | --- |
| [`ADR-001`](decisions/ADR-001-identity-local-credentials.md) | Identity local credentials and session baseline |
| [`ADR-002`](decisions/ADR-002-production-rate-limiting.md) | Production rate-limiting strategy |
| [`ADR-014`](decisions/ADR-014-vnpay-online-payment.md) | VNPay online-payment boundary |
| [`ADR-015`](decisions/ADR-015-password-reset-delivery-outbox.md) | Transactional password-reset delivery outbox |

## Deployment documentation

Local Docker and Render staging are the active low-cost paths. AWS documents
remain design references while AWS execution is explicitly deferred for budget
reasons. A design document is not deployment evidence.

- Local: [`LOCAL_RUNTIME_AUDIT.md`](LOCAL_RUNTIME_AUDIT.md),
  [`LOCAL_DEMO_READINESS_REPORT.md`](LOCAL_DEMO_READINESS_REPORT.md)
- Render: [`RENDER_STAGING_RUNBOOK.md`](RENDER_STAGING_RUNBOOK.md)
- Cloud decision: [`CLOUD_DEPLOYMENT_ARCHITECTURE.md`](CLOUD_DEPLOYMENT_ARCHITECTURE.md)
- Deferred AWS design: `AWS_*`, `STAGING_*`, `ECR_*`,
  `TERRAFORM_*`, [`RELEASE_ARTIFACT_STRATEGY.md`](RELEASE_ARTIFACT_STRATEGY.md)

## Feature reports

Files ending in `_AUDIT.md`, `_IMPLEMENTATION_REPORT.md`, `_FIX_REPORT.md` and
`_COMPLETION_REPORT*.md` are point-in-time evidence for their named feature.
Keep them for traceability, but use the canonical contracts above for current
behavior. Visual evidence belongs under [`images/`](images/) or
[`screenshots/`](screenshots/); text evidence belongs under [`evidence/`](evidence/).

## Document conventions

- Use uppercase snake-case filenames for specifications, runbooks and reports.
- Use `ADR-NNN-short-title.md` for decisions, with a unique numeric identifier.
- Start maintained documents with a title, status, review date and purpose.
- Link using repository-relative paths; do not use machine-specific absolute
  paths.
- Never include secrets, production credentials, raw customer data, database
  dumps, local logs, build output or test traces.
- Preserve historical execution reports. Add a supersession note instead of
  silently rewriting past evidence.
- Record commands as `PASS` only when they were executed against the referenced
  revision and environment.

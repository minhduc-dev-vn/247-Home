# Phase 1 Release Baseline Record

**Date:** 2026-07-28
**Scope:** Phase 1 of `CURRENT_SYSTEM_REMEDIATION_PLAN.md`
**Candidate ref:** `v0.1.0-phase1-rc.1` (created after this reviewed commit)
**Release branch:** `release/phase-1-baseline`

## Purpose

This record identifies the repository-level release candidate for the current
remediation phase. It is deliberately separate from Render deployment evidence:
no Render configuration, external database, secret rotation, migration, or
deployment was performed while creating this record.

## Included Changes

- Customer registration diagnostics keep the public response safe while exposing
  a request ID for support correlation.
- The `CUSTOMER` reference role is recovered transactionally only when missing;
  the forward migration remains the authoritative way to install reference data.
- Password forms and server validation use the approved current minimum of eight
  characters, with unit and browser coverage.
- `/api/health` includes a non-sensitive deployment revision when Render exposes
  `RENDER_GIT_COMMIT` or `GIT_SHA`.
- Playwright starts its own current-source server by default. Reuse is explicit
  through `PLAYWRIGHT_REUSE_EXISTING_SERVER=true`, preventing a stale Docker or
  Next process from silently satisfying the health probe.

## Deliberately Excluded From This Candidate

- Customer order/product/warranty pagination changes.
- Query-schema tracking-parameter changes and their tests.
- `ISSUES.md`, which is a separate historical working document.
- Any `.env`, external credential, generated output, test trace, Docker volume,
  or provider configuration.

## Verified Local Evidence

| Check | Result |
| --- | --- |
| `pnpm db:migrate` against local PostgreSQL | PASS - 16 migrations, no pending migrations |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 36 files, 182 tests |
| `pnpm test:integration` | PASS - 11 files, 87 tests on PostgreSQL |
| `pnpm test:migration` | PASS - valid-history upgrade and invalid-history rollback checks |
| `pnpm test:e2e` | PASS - 48 Playwright tests on a fresh Next dev server |
| `pnpm build` | PASS - Next.js production build |
| `pnpm audit:prod` | PASS - 180 packages, no moderate-or-higher advisories |

## Branch Reconciliation Decision

`main` is materially divergent from `feature/auto-update` and removes payment,
identity-role migration, deployment, and documentation artifacts that are still
present in the candidate. It must not be merged into the candidate by an
automatic conflict strategy. Instead, `release/phase-1-baseline` is submitted as
a normal pull request to `main` for explicit review. The pull request is the
reconciliation mechanism; no force push or destructive history rewrite is used.

## Remaining External Gates

- Rotate the exposed database credential through the database/Render owner.
- Configure the Render health check to call `/api/ready`, not liveness-only
  `/api/health`.
- Select this candidate branch/commit in Render and record the deployed SHA.
- Run migration and smoke verification through the approved staging procedure.

Those actions require the service/database owner and are not represented as
completed by this repository record.

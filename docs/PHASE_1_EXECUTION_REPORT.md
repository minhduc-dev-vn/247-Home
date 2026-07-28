# Phase 1 Execution Report

**Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
**Executed:** 2026-07-28
**Scope:** Phase 1 - Establish a Reproducible Release Baseline

## Status

| Area | Status | Evidence |
| --- | --- | --- |
| Repository baseline | PASS | Reviewed, committed, tagged, and pushed. |
| Main reconciliation | PASS | Normal merge commit `ec9a33cdc5e548dbc50bf884d14e93bdb77484d9`; PR is mergeable. |
| Local quality gates | PASS | PostgreSQL-backed migration, integration, and E2E gates passed. |
| GitHub Actions | PASS | PR CI run `30342072826` passed all configured steps. |
| Render staging activation | PENDING OWNER | No Render service configuration or deployment was performed. |
| External credential rotation | PENDING OWNER | Must be done in the database provider and Render secret settings. |

**Phase 1 repository baseline is complete.** It is not a claim that Render
staging is deployed or that the project is production-ready.

## Release References

| Item | Value |
| --- | --- |
| Source baseline commit | `c1b5cb91e53bffa7ba2cd09594ba41a7207117cc` |
| Reconciled release commit | `ec9a33cdc5e548dbc50bf884d14e93bdb77484d9` |
| Release branch | `release/phase-1-baseline` |
| Reconciled tag | `v0.1.0-phase1-rc.2` |
| Pull request | [#1 - Release baseline: registration diagnostics and reproducible E2E](https://github.com/minhduc-dev-vn/247-Home/pull/1) |
| GitHub Actions evidence | [CI run 30342072826](https://github.com/minhduc-dev-vn/247-Home/actions/runs/30342072826) |

The merge retained `.env.example` and `.env.demo.example`. They contain only
local/demo placeholder values and are required for reproducible local runtime
guidance. No production credential was added to Git.

## Completed Work

- Reviewed and separated unrelated customer pagination/query work from the
  candidate. Those files remain unstaged in the original worktree.
- Committed identity registration diagnostics, the eight-character password
  policy, health revision metadata, relevant tests, audit/remediation records,
  and Playwright server-isolation configuration.
- Changed Playwright to start a current-source server by default. Reusing an
  existing server now requires `PLAYWRIGHT_REUSE_EXISTING_SERVER=true`.
- Reconciled `main` through a normal merge in an isolated worktree. The only
  conflicts were the two env templates; no runtime source tree changed relative
  to the locally tested candidate.
- Pushed the feature branch, release branch, and release tags. Opened PR #1
  rather than merging into `main` automatically.
- Restored the previously running local Docker app after isolated E2E runs.

## Verification

| Command / check | Result |
| --- | --- |
| `pnpm db:up` | PASS - local PostgreSQL healthy at `127.0.0.1:5433` |
| `pnpm db:migrate` | PASS - 16 migrations, no pending migrations |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 36 files, 182 tests |
| `pnpm test:integration` | PASS - 11 files, 87 tests on PostgreSQL |
| `pnpm test:migration` | PASS - valid history and rollback rejection scenarios |
| `pnpm test:e2e` | PASS - 48 Playwright tests on a fresh server |
| `pnpm build` | PASS |
| `pnpm audit:prod` | PASS - no moderate-or-higher advisory |
| Release branch migration check | PASS - includes online-payment and identity-role migrations |
| GitHub Actions PR CI | PASS - install, migration, seed, all tests, and build |

## External Follow-up Required

1. The Render owner must select `release/phase-1-baseline` (or the immutable
   tag/commit approved after PR review), configure the health check as
   `/api/ready`, and record the deployed SHA.
2. Rotate the database credential that was exposed in support, then update only
   the provider/Render secret store. Do not paste the replacement into Git or
   documentation.
3. Execute the approved staging migration and smoke procedure. Verify
   `/api/health` reports the deployed revision and `/api/ready` reports database
   readiness.
4. The automatic Vercel Preview status is failing. Vercel is not the selected
   Render release target, but its integration must be fixed, disabled, or made
   non-required by its owner before PR merge policy can be considered clean.
   The Vercel logs were not accessible from this environment.
5. The public custom-domain health request could not establish a trusted TLS
   connection during this execution. Validate DNS/certificate configuration with
   the domain/Render owner before publishing public traffic.

## Residual Risks

- Phase 2 through Phase 7 findings remain open, including password-reset
  production delivery, inventory/slot release lifecycle, payment-session
  exclusivity, distributed rate limiting, and production object storage.
- CI emitted a Node.js 20 action-runtime deprecation annotation. It did not fail
  this run, but GitHub Action runtime updates should be scheduled.
- The original worktree intentionally retains unrelated uncommitted pagination,
  query-schema, and historical-audit changes. They are not included in the
  release baseline and need their own review/test/commit.
